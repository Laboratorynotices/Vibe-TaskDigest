// @vitest-environment node
/**
 * Тесты скрипта создания нового SDD-задания.
 *
 * Скрипт работает с файловой системой, поэтому каждый тест создаёт временный
 * корень проекта внутри рабочей папки проекта (наружу ничего не пишется) и
 * удаляет его после себя.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  createTaskFile,
  determineNumbering,
  parseTaskFileName,
  scanTasks,
  slugifyTitle,
  MAX_SLUG_LENGTH,
} from "./create-task";
import type { TaskFileEntry } from "./create-task";

/** Временный корень проекта для одного теста. */
let rootDir = "";

beforeEach(() => {
  rootDir = mkdtempSync(join(process.cwd(), ".tmp-sdd-new-task-"));
});

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true });
});

/**
 * Создаёт файл по пути относительно корня проекта вместе с родительскими
 * каталогами.
 */
function writeFixture(
  relativePath: string,
  content = "задание",
): string {
  const filePath = join(rootDir, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
  return filePath;
}

/**
 * Собирает минимальную запись задания для проверки нумерации.
 */
function task(number: number, width: number): TaskFileEntry {
  return {
    number,
    width,
    fileName: `${String(number).padStart(width, "0")}-task.md`,
    directory: "backlog",
    relativePath: `docs/tasks/backlog/${String(number).padStart(width, "0")}-task.md`,
  };
}

describe("parseTaskFileName", () => {
  test("разбирает корректное имя задания", () => {
    expect(parseTaskFileName("0012-add-report.md")).toEqual({
      number: 12,
      width: 4,
      wellFormed: true,
    });
  });

  test("поддерживает номер другой ширины", () => {
    expect(parseTaskFileName("10001-next-step.md")).toEqual({
      number: 10001,
      width: 5,
      wellFormed: true,
    });
  });

  test("отмечает имя без корректного описания", () => {
    expect(parseTaskFileName("0007-Bad Name.md")).toEqual({
      number: 7,
      width: 4,
      wellFormed: false,
    });
  });

  test("не считает README и посторонние файлы заданиями", () => {
    expect(parseTaskFileName("README.md")).toBeNull();
    expect(parseTaskFileName("notes.md")).toBeNull();
    expect(parseTaskFileName("0012-report.txt")).toBeNull();
  });

  test("не считает заданием имя без цифр в начале", () => {
    expect(parseTaskFileName("task-0012.md")).toBeNull();
  });
});

describe("scanTasks", () => {
  test("находит задания во всех пяти каталогах SDD", () => {
    writeFixture("docs/tasks/0001-in-work.md");
    writeFixture("docs/tasks/backlog/0002-in-backlog.md");
    writeFixture("docs/tasks/done/0003-done.md");
    writeFixture("docs/tasks/failed/0004-failed.md");
    writeFixture("docs/tasks/questions/0005-questions.md");

    const result = scanTasks(rootDir);

    expect(result.tasks.map((entry) => entry.number)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(result.warnings).toEqual([]);
  });

  test("не учитывает README и файлы не по формату", () => {
    writeFixture("docs/tasks/README.md");
    writeFixture("docs/tasks/backlog/README.md");
    writeFixture("docs/tasks/backlog/notes.md");
    writeFixture("docs/tasks/backlog/0012-report.txt");

    const result = scanTasks(rootDir);

    expect(result.tasks).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test("возвращает пустой результат, если каталогов заданий нет", () => {
    const result = scanTasks(rootDir);

    expect(result.tasks).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test("предупреждает о файле с некорректным именем", () => {
    writeFixture("docs/tasks/backlog/0007-Bad Name.md");

    const result = scanTasks(rootDir);

    expect(result.tasks.map((entry) => entry.number)).toEqual([7]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("0007-Bad Name.md");
  });

  test("предупреждает о повторяющемся номере", () => {
    writeFixture("docs/tasks/done/0003-first.md");
    writeFixture("docs/tasks/backlog/0003-second.md");

    const result = scanTasks(rootDir);

    expect(result.tasks).toHaveLength(2);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Номер 3");
  });

  test("задания отсортированы по номеру", () => {
    writeFixture("docs/tasks/backlog/0009-later.md");
    writeFixture("docs/tasks/backlog/0002-earlier.md");

    const result = scanTasks(rootDir);

    expect(result.tasks.map((entry) => entry.number)).toEqual([2, 9]);
  });
});

describe("determineNumbering", () => {
  test("начинает нумерацию с 0001, если заданий нет", () => {
    expect(determineNumbering([])).toEqual({
      number: 1,
      padded: "0001",
      width: 4,
    });
  });

  test("берёт следующий номер после максимального", () => {
    expect(determineNumbering([task(1, 4), task(11, 4)])).toEqual({
      number: 12,
      padded: "0012",
      width: 4,
    });
  });

  test("опирается на максимум, а не на количество файлов", () => {
    expect(determineNumbering([task(1, 4), task(9, 4)]).padded).toBe("0010");
  });

  test("сохраняет принятую в проекте ширину номера", () => {
    expect(determineNumbering([task(10000, 5), task(10001, 5)]).padded).toBe(
      "10002",
    );
  });

  test("при разной ширине использует минимум четыре цифры", () => {
    expect(determineNumbering([task(9, 2), task(1000, 4)])).toEqual({
      number: 1001,
      padded: "1001",
      width: 4,
    });
  });

  test("дописывает номер полностью, если он не помещается в ширину", () => {
    expect(determineNumbering([task(9999, 4)]).padded).toBe("10000");
  });
});

describe("slugifyTitle", () => {
  test("приводит английское название к slug", () => {
    expect(slugifyTitle("Add PDF Report Generation")).toBe(
      "add-pdf-report-generation",
    );
  });

  test("транслитерирует кириллицу", () => {
    expect(slugifyTitle("Добавление PDF-отчётов")).toBe(
      "dobavlenie-pdf-otchetov",
    );
  });

  test("убирает лишние символы и дефисы по краям", () => {
    expect(slugifyTitle("  Fix: bug #42!  ")).toBe("fix-bug-42");
  });

  test("возвращает имя по умолчанию для пустого описания", () => {
    expect(slugifyTitle("")).toBe("new-task");
    expect(slugifyTitle("   ---   ")).toBe("new-task");
  });

  test("ограничивает длину и не оставляет дефис в конце", () => {
    const slug = slugifyTitle("word ".repeat(40));

    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("createTaskFile", () => {
  test("создаёт пустой файл в backlog с правильным именем", () => {
    writeFixture("docs/tasks/done/0011-previous.md");

    const created = createTaskFile({
      rootDir,
      title: "Add PDF Report Generation",
    });

    expect(created.padded).toBe("0012");
    expect(created.relativePath).toBe(
      "docs/tasks/backlog/0012-add-pdf-report-generation.md",
    );
    expect(statSync(created.filePath).size).toBe(0);
  });

  test("не записывает переданное описание в файл", () => {
    const created = createTaskFile({
      rootDir,
      title: "Добавление PDF-отчётов",
    });

    expect(readFileSync(created.filePath, "utf8")).toBe("");
  });

  test("использует new-task, если описание не передано", () => {
    const created = createTaskFile({ rootDir });

    expect(created.relativePath).toBe("docs/tasks/backlog/0001-new-task.md");
  });

  test("создаёт каталог backlog, если его нет", () => {
    mkdirSync(join(rootDir, "docs", "tasks"), { recursive: true });

    const created = createTaskFile({ rootDir, title: "First task" });

    expect(statSync(created.filePath).isFile()).toBe(true);
  });

  test("не перезаписывает существующий файл", () => {
    const existing = writeFixture(
      "docs/tasks/backlog/0001-add-pdf-report-generation.md",
      "исходное задание",
    );

    const created = createTaskFile({
      rootDir,
      title: "Add PDF Report Generation",
    });

    expect(created.relativePath).toBe(
      "docs/tasks/backlog/0002-add-pdf-report-generation.md",
    );
    expect(readFileSync(existing, "utf8")).toBe("исходное задание");
  });

  test("повторный вызов создаёт файл со следующим номером", () => {
    const first = createTaskFile({ rootDir, title: "First" });
    const second = createTaskFile({ rootDir, title: "Second" });

    expect(first.padded).toBe("0001");
    expect(second.padded).toBe("0002");
    expect(statSync(first.filePath).size).toBe(0);
    expect(statSync(second.filePath).size).toBe(0);
  });

  test("учитывает задания из статусных каталогов", () => {
    writeFixture("docs/tasks/done/0005-old.md");
    writeFixture("docs/tasks/failed/0006-failed.md");

    const created = createTaskFile({ rootDir, title: "Next" });

    expect(created.padded).toBe("0007");
  });

  test("возвращает предупреждения о неоднозначных именах", () => {
    writeFixture("docs/tasks/done/0003-first.md");
    writeFixture("docs/tasks/backlog/0003-second.md");

    const created = createTaskFile({ rootDir, title: "Next" });

    expect(created.padded).toBe("0004");
    expect(created.warnings).toHaveLength(1);
  });
});
