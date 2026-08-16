import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dirFixtures = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');

/**
 * URL file:// de uma fixture dos passos do wizard. Usada pelos testes de
 * navegador e pelo modo ensaio da CLI (`--ensaio`), que roda os comandos
 * reais contra estas páginas locais — nada toca o portal.
 */
export function urlFixture(nome: string): string {
  return pathToFileURL(join(dirFixtures, nome)).href;
}
