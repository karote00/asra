import { includeIgnoreFile } from '@eslint/compat'
import js from '@eslint/js'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
// import eslintPluginReactRecommended from 'eslint-plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const gitignorePath = path.resolve(__dirname, '.gitignore')

export default [
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  includeIgnoreFile(gitignorePath),
  {
    rules: {
      indent: ['error', 2],
      quotes: ['error', 'single'],
      'no-console': 'warn',
      'no-unused-vars': 'error'
    }
  }
]
