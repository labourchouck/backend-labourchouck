/**
 * Puts the Mappto Terms & Conditions and Privacy Policy into the database (all roles).
 *
 * - Only replaces documents still in the old free-form format (no "## " headings).
 *   Documents already in the new format — including ones an admin has edited since — are
 *   left alone, so re-running is safe.
 * - Every replaced document's previous text is saved to
 *   scripts/assets/legal/previous-legal-docs.json so it can be restored.
 *
 * Usage: npm run seed:legal
 */
import '../config/env.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { connectDb } from '../config/db.js'
import { TermsAndCondition } from '../models/TermsAndCondition.js'
import { PrivacyPolicy } from '../models/PrivacyPolicy.js'
import { USER_ROLES } from '../constants/roles.js'
import { DEFAULT_TERMS_TEXT, DEFAULT_PRIVACY_TEXT, DEFAULT_SUPPORT_TEXT, DEFAULT_CORPORATE_TERMS_TEXT, DEFAULT_CORPORATE_PRIVACY_TEXT, DEFAULT_CORPORATE_SUPPORT_TEXT } from '../data/defaultLegalDocs.js'
import { SupportPolicy } from '../models/SupportPolicy.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = path.join(__dirname, 'assets', 'legal')
const BACKUP_FILE = path.join(BACKUP_DIR, 'previous-legal-docs.json')

const ROLES = [USER_ROLES.INDIVIDUAL, USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.CORPORATE]
const TARGETS = [
  { name: 'terms', Model: TermsAndCondition, text: DEFAULT_TERMS_TEXT, corporateText: DEFAULT_CORPORATE_TERMS_TEXT },
  { name: 'privacy', Model: PrivacyPolicy, text: DEFAULT_PRIVACY_TEXT, corporateText: DEFAULT_CORPORATE_PRIVACY_TEXT },
  { name: 'support', Model: SupportPolicy, text: DEFAULT_SUPPORT_TEXT, corporateText: DEFAULT_CORPORATE_SUPPORT_TEXT },
  
]

const isNewFormat = (content) => /^##\s+\S/m.test(String(content || ''))

async function run() {
  await connectDb()

  const backup = []
  let written = 0
  let skipped = 0

  for (const { name, Model, text, corporateText } of TARGETS) {
    for (const role of ROLES) {
      const existing = await Model.findOne({ role })
      if (false && existing && isNewFormat(existing.content)) {
        skipped += 1
        console.log(`[seed:legal] ${name} · ${role}: already in new format, skipped`)
        continue
      }
      if (existing?.content) {
        backup.push({ doc: name, role, previousContent: existing.content, previousUpdatedAt: existing.updatedAt })
      }
      const contentToSave = role === USER_ROLES.CORPORATE ? corporateText : text;
      await Model.findOneAndUpdate({ role }, { $set: { content: contentToSave } }, { upsert: true, new: true })
      written += 1
      console.log(`[seed:legal] ${name} · ${role}: written`)
    }
  }

  if (backup.length) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const prev = fs.existsSync(BACKUP_FILE) ? JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8')) : []
    prev.push({ at: new Date().toISOString(), docs: backup })
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(prev, null, 2))
    console.log(`[seed:legal] previous text of ${backup.length} document(s) saved to ${path.relative(process.cwd(), BACKUP_FILE)}`)
  }

  console.log(`[seed:legal] done · written ${written}, skipped ${skipped}`)
}

run()
  .catch((err) => {
    console.error('[seed:legal] failed:', err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
