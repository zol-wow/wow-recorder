/**
 * archiver is ESM only, which Jest can't load. Tests don't create zip
 * files, so an empty stand-in is enough for modules to load.
 */
export class ZipArchive {}
