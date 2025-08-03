/** Base class for all conversion failures. */
export class ConversionError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ConversionError';
  }
}

/** Thrown when the target .docx already exists. */
export class FileExistsError extends ConversionError {
  constructor(public readonly path: string) {
    super(`File already exists at ${path}`);
    this.name = 'FileExistsError';
  }
}

/** Thrown when the Markdown cannot be parsed/converted. */
export class InvalidMarkdownError extends ConversionError {
  constructor(details?: string) {
    super(`Invalid Markdown: ${details ?? 'see log'}`);
    this.name = 'InvalidMarkdownError';
  }
}

/** Map any ConversionError (or unknown) to a friendly string. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof FileExistsError) {
    return `A DOCX already exists at “${err.path}”. Please rename your note or confirm overwrite in settings.`;
  }
  if (err instanceof InvalidMarkdownError) {
    return `Your note couldn't be parsed: ${err.message.replace('Invalid Markdown: ', '')}. Please check your syntax.`;
  }
  if (err instanceof ConversionError) {
    return `Conversion failed: ${err.message}`;
  }
  // Fallback for truly unexpected errors
  const msg = err instanceof Error ? err.message : String(err);
  return `An unexpected error occurred: ${msg}`;
}
