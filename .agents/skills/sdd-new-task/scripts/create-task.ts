/**
 * Создание нового пустого задания в системе SDD.
 *
 * Модуль решает одну задачу: находит максимальный использованный номер задания
 * во всех каталогах `docs/tasks/`, вычисляет следующий номер и создаёт в
 * `docs/tasks/backlog/` пустой (0 байт) Markdown-файл, имя которого построено
 * по шаблону `NNNN-description.md`. Содержимое в файл не записывается: его
 * заполняет пользователь.
 *
 * Скрипт запускается из корня проекта:
 *
 * ```bash
 * bun .agents/skills/sdd-new-task/scripts/create-task.ts "добавление PDF-отчётов"
 * ```
 *
 * Экспортированные функции используются тестами
 * (`create-task.spec.ts`) и не имеют побочных эффектов при импорте: точка
 * входа CLI срабатывает только при прямом запуске файла.
 */
import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Каталоги, в которых ищутся номера заданий, относительно `docs/tasks`.
 *
 * Пустая строка — сама директория `docs/tasks`; остальные значения — статусные
 * каталоги. Номер задания нельзя переиспользовать, поэтому учитываются все
 * статусы, а не только `backlog`.
 */
export const TASK_DIRECTORIES = [
  "",
  "backlog",
  "done",
  "failed",
  "questions",
] as const;

/** Минимальная ширина номера: не меньше четырёх цифр с ведущими нулями. */
export const DEFAULT_ID_WIDTH = 4;

/** Имя файла по умолчанию, если пользователь не передал описание задания. */
export const FALLBACK_SLUG = "new-task";

/** Максимальная длина описательной части имени файла в символах. */
export const MAX_SLUG_LENGTH = 60;

/** Сколько раз повторять создание, если номер успел занять другой файл. */
export const MAX_CREATE_ATTEMPTS = 5;

/** Допустимый slug в имени файла: латиница в нижнем регистре, цифры, дефисы. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Соответствие кириллических букв латинским при построении slug.
 *
 * Нужно, потому что пользователь формулирует задание по-русски, а имя файла
 * обязано состоять только из латиницы, цифр и дефисов.
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  і: "i",
  ї: "i",
  є: "e",
  ґ: "g",
};

/**
 * Разобранное имя файла задания.
 */
export interface ParsedTaskFileName {
  /** Числовой идентификатор задания. */
  readonly number: number;
  /** Количество цифр в идентификаторе — принятая ширина номера. */
  readonly width: number;
  /** `true`, если описательная часть соответствует slug-формату. */
  readonly wellFormed: boolean;
}

/**
 * Найденный в проекте файл задания.
 */
export interface TaskFileEntry {
  /** Числовой идентификатор задания. */
  readonly number: number;
  /** Количество цифр в идентификаторе. */
  readonly width: number;
  /** Имя файла без пути. */
  readonly fileName: string;
  /** Каталог хранения относительно `docs/tasks`: `"."`, `"backlog"` и т. д. */
  readonly directory: string;
  /** Путь файла относительно корня проекта, с прямыми слэшами. */
  readonly relativePath: string;
}

/**
 * Результат поиска заданий во всех каталогах SDD.
 */
export interface TaskScanResult {
  /** Найденные задания, отсортированные по номеру и пути. */
  readonly tasks: readonly TaskFileEntry[];
  /**
   * Предупреждения о неоднозначных или некорректных именах: повторяющийся
   * номер, имя не по шаблону `NNNN-description.md`. Это не ошибка поиска:
   * такие файлы всё равно занимают номер.
   */
  readonly warnings: readonly string[];
}

/**
 * Вычисленная нумерация следующего задания.
 */
export interface TaskNumbering {
  /** Следующий свободный номер. */
  readonly number: number;
  /** Номер с ведущими нулями — часть имени файла. */
  readonly padded: string;
  /** Ширина номера в цифрах. */
  readonly width: number;
}

/**
 * Параметры создания файла задания.
 */
export interface CreateTaskOptions {
  /** Корень проекта: внутри него ожидается `docs/tasks/backlog/`. */
  readonly rootDir: string;
  /** Краткое описание задания для имени файла; в содержимое не попадает. */
  readonly title?: string;
}

/**
 * Результат создания файла задания.
 */
export interface CreatedTask {
  /** Следующий свободный номер. */
  readonly number: number;
  /** Номер с ведущими нулями. */
  readonly padded: string;
  /** Абсолютный путь созданного файла. */
  readonly filePath: string;
  /** Путь созданного файла относительно корня проекта. */
  readonly relativePath: string;
  /** Предупреждения, обнаруженные при сканировании каталогов заданий. */
  readonly warnings: readonly string[];
}

/**
 * Разбирает имя файла как имя задания SDD.
 *
 * Номером задания считается файл, имя которого начинается с цифр и
 * заканчивается `.md`, за которыми идёт необязательное описание через дефис.
 * Такой файл занимает номер, даже если описание оформлено неверно, — номер
 * переиспользовать нельзя.
 *
 * @param fileName Имя файла без пути.
 * @returns Номер, ширину и корректность формата; `null`, если имя не похоже
 *   на имя задания (например, `README.md` или `notes.md`).
 * @example
 * parseTaskFileName("0012-add-report.md");
 * // { number: 12, width: 4, wellFormed: true }
 */
export function parseTaskFileName(
  fileName: string,
): ParsedTaskFileName | null {
  const match = /^(\d+)(?:-(.*))?\.md$/i.exec(fileName);
  if (!match) {
    return null;
  }

  const digits = match[1] ?? "";
  const description = match[2] ?? "";
  const number = Number(digits);
  if (!Number.isSafeInteger(number) || number <= 0) {
    return null;
  }

  return {
    number,
    width: digits.length,
    wellFormed: SLUG_PATTERN.test(description),
  };
}

/**
 * Читает список файлов каталога, не падая на отсутствующей директории.
 *
 * @param absoluteDir Абсолютный путь каталога.
 * @returns Записи каталога; пустой массив, если каталога нет или его нельзя
 *   прочитать.
 */
function readDirectoryEntries(absoluteDir: string) {
  try {
    return readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Приводит путь к виду с прямыми слэшами — независимо от платформы.
 *
 * @param filePath Путь, возможно с `\` на Windows.
 * @returns Путь с `/` в качестве разделителя.
 */
function normalizeSlashes(filePath: string): string {
  return filePath.split("\\").join("/");
}

/**
 * Ищет задания во всех каталогах SDD: `docs/tasks` и его статусные подкаталоги.
 *
 * `README.md` и файлы, не начинающиеся с номера, не учитываются. Задания в
 * `done/`, `failed/` и `questions/` тоже занимают номера.
 *
 * @param rootDir Корень проекта.
 * @returns Найденные задания и предупреждения о неоднозначных именах.
 * @example
 * scanTasks(process.cwd()).tasks.map((task) => task.number);
 * // [1, 2, 3]
 */
export function scanTasks(rootDir: string): TaskScanResult {
  const tasksDir = join(rootDir, "docs", "tasks");
  const tasks: TaskFileEntry[] = [];
  const warnings: string[] = [];
  const filesByNumber = new Map<number, string[]>();

  for (const directory of TASK_DIRECTORIES) {
    const absoluteDir = join(tasksDir, directory);
    for (const entry of readDirectoryEntries(absoluteDir)) {
      if (!entry.isFile()) {
        continue;
      }
      if (!/\.md$/i.test(entry.name) || /^readme\.md$/i.test(entry.name)) {
        continue;
      }

      const parsed = parseTaskFileName(entry.name);
      if (parsed === null) {
        continue;
      }

      const relativePath = normalizeSlashes(
        relative(rootDir, join(absoluteDir, entry.name)),
      );
      tasks.push({
        number: parsed.number,
        width: parsed.width,
        fileName: entry.name,
        directory: directory === "" ? "." : directory,
        relativePath,
      });

      if (!parsed.wellFormed) {
        warnings.push(
          `Файл «${relativePath}» не соответствует формату ` +
            `NNNN-description.md.`,
        );
      }

      const sameNumber = filesByNumber.get(parsed.number) ?? [];
      sameNumber.push(relativePath);
      filesByNumber.set(parsed.number, sameNumber);
    }
  }

  for (const [number, files] of filesByNumber) {
    if (files.length > 1) {
      warnings.push(
        `Номер ${number} используется несколькими файлами: ` +
          `${files.join(", ")}.`,
      );
    }
  }

  tasks.sort(
    (left, right) =>
      left.number - right.number ||
      left.relativePath.localeCompare(right.relativePath),
  );

  return { tasks, warnings };
}

/**
 * Вычисляет номер следующего задания.
 *
 * Номер — это максимум найденных номеров плюс один, а не количество файлов.
 * Ширина номера повторяет принятую в проекте, если все задания используют
 * одинаковую; иначе берётся минимум четыре цифры. Если следующий номер не
 * помещается в ширину, он дописывается полностью.
 *
 * @param tasks Найденные задания.
 * @returns Следующий номер, его ширина и строка с ведущими нулями.
 * @example
 * determineNumbering([{ number: 11, width: 4, ... }]).padded; // "0012"
 */
export function determineNumbering(
  tasks: readonly TaskFileEntry[],
): TaskNumbering {
  const maxNumber = tasks.reduce(
    (max, task) => (task.number > max ? task.number : max),
    0,
  );
  const number = maxNumber + 1;

  const widths = new Set(tasks.map((task) => task.width));
  const [onlyWidth] = widths;
  const width =
    widths.size === 1 && onlyWidth !== undefined
      ? onlyWidth
      : DEFAULT_ID_WIDTH;

  return { number, padded: String(number).padStart(width, "0"), width };
}

/**
 * Преобразует описание задания в безопасный slug для имени файла.
 *
 * Кириллица транслитерируется латиницей, остальные недопустимые символы
 * заменяются дефисами. Результат: нижний регистр, только латиница, цифры и
 * дефисы, без дефиса на краях, не длиннее {@link MAX_SLUG_LENGTH} символов.
 *
 * @param title Описание задания в свободной форме.
 * @returns Slug; `new-task`, если после очистки в описании ничего не осталось.
 * @example
 * slugifyTitle("Добавление PDF-отчётов"); // "dobavlenie-pdf-otchetov"
 */
export function slugifyTitle(title: string): string {
  const transliterated = title
    .toLowerCase()
    .replace(/[а-яёіїєґ]/g, (letter) => CYRILLIC_TO_LATIN[letter] ?? "");

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return slug === "" ? FALLBACK_SLUG : slug;
}

/**
 * Проверяет, что ошибка создания файла означает занятое имя.
 *
 * @param error Ошибка, выброшенная системным вызовом.
 * @returns `true` для `EEXIST`: файл с таким именем уже существует.
 */
function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EEXIST"
  );
}

/**
 * Создаёт пустой файл нового задания в `docs/tasks/backlog/`.
 *
 * Каталог `backlog` создаётся при отсутствии. Файл открывается эксклюзивно
 * (`wx`), поэтому существующий файл никогда не перезаписывается: при
 * конфликте имён номера вычисляются заново и попытка повторяется. В файл не
 * записывается ни байта — описание используется только в имени.
 *
 * @param options Корень проекта и необязательное описание задания.
 * @returns Номер, путь созданного файла и предупреждения сканирования.
 * @throws Если не удалось подобрать свободное имя за
 *   {@link MAX_CREATE_ATTEMPTS} попыток или созданный файл оказался не пуст.
 * @example
 * createTaskFile({ rootDir: process.cwd(), title: "PDF reports" });
 * // создаёт docs/tasks/backlog/0012-pdf-reports.md размером 0 байт
 */
export function createTaskFile(options: CreateTaskOptions): CreatedTask {
  const backlogDir = join(options.rootDir, "docs", "tasks", "backlog");
  mkdirSync(backlogDir, { recursive: true });

  const slug = slugifyTitle(options.title ?? "");
  let warnings: readonly string[] = [];

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const scan = scanTasks(options.rootDir);
    warnings = scan.warnings;

    const numbering = determineNumbering(scan.tasks);
    const fileName = `${numbering.padded}-${slug}.md`;
    const filePath = join(backlogDir, fileName);

    try {
      closeSync(openSync(filePath, "wx"));
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        continue;
      }
      throw error;
    }

    const relativePath = normalizeSlashes(relative(options.rootDir, filePath));
    const size = statSync(filePath).size;
    if (size !== 0) {
      throw new Error(
        `Созданный файл «${relativePath}» не пуст: ${size} байт.`,
      );
    }

    return { ...numbering, filePath, relativePath, warnings };
  }

  throw new Error(
    `Не удалось создать файл задания за ${MAX_CREATE_ATTEMPTS} попыток: ` +
      `номер всё время оказывается занятым.`,
  );
}

/**
 * Запускает создание задания и печатает результат для пользователя.
 *
 * @param argv Аргументы командной строки без имени скрипта: всё, что передано,
 *   склеивается в описание задания.
 * @param rootDir Корень проекта.
 * @returns Код выхода: `0` при успехе, `1` при ошибке.
 */
export function runCreateTask(
  argv: readonly string[],
  rootDir: string,
): number {
  const title = argv.join(" ").trim();

  try {
    const created = createTaskFile({ rootDir, title });
    for (const warning of created.warnings) {
      console.warn(`Предупреждение: ${warning}`);
    }
    console.log(
      `Создан пустой файл нового SDD-задания: ${created.relativePath}`,
    );
    console.log(`Присвоен следующий свободный номер: ${created.padded}`);
    console.log(
      "Файл находится в backlog и готов к заполнению (размер: 0 байт).",
    );
    return 0;
  } catch (error) {
    console.error(
      `Не удалось создать задание: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return 1;
  }
}

/** Абсолютный адрес файла — для отличия прямого запуска от импорта в тестах. */
const moduleUrl = import.meta.url;

/** Адрес запущенного скрипта из аргументов командной строки. */
const entryUrl =
  process.argv[1] === undefined
    ? undefined
    : pathToFileURL(process.argv[1]).href;

if (entryUrl === moduleUrl) {
  process.exitCode = runCreateTask(process.argv.slice(2), process.cwd());
}
