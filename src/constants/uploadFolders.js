import { USER_ROLES } from './roles.js'

/** Cloudinary path segment under root prefix `labourchowck/`. */
export const UPLOAD_FOLDERS = Object.freeze({
  PROFILES: 'profiles',
  LABOUR_CATEGORIES: 'labour-categories',
  JOB_POSTERS: 'job-posters',
  KYC_DOCUMENTS: 'kyc-documents',
  KYC_VIDEOS: 'kyc-videos',
  GENERAL_MEDIA: 'general-media',
})

export const UPLOAD_ROOT_PREFIX = process.env.CLOUDINARY_ROOT_FOLDER || 'labourchowck'

/** Folders accepted by POST /uploads/media */
export const MEDIA_FOLDER_SET = new Set([
  UPLOAD_FOLDERS.PROFILES,
  UPLOAD_FOLDERS.LABOUR_CATEGORIES,
  UPLOAD_FOLDERS.JOB_POSTERS,
  UPLOAD_FOLDERS.KYC_VIDEOS,
  UPLOAD_FOLDERS.GENERAL_MEDIA,
])

/** Folders accepted by POST /uploads/documents */
export const DOCUMENT_FOLDER_SET = new Set([
  UPLOAD_FOLDERS.KYC_DOCUMENTS,
  UPLOAD_FOLDERS.GENERAL_MEDIA,
])

const ROLE_MEDIA_FOLDERS = {
  [USER_ROLES.ADMIN]: MEDIA_FOLDER_SET,
  [USER_ROLES.LABOUR]: new Set([
    UPLOAD_FOLDERS.PROFILES,
    UPLOAD_FOLDERS.KYC_VIDEOS,
    UPLOAD_FOLDERS.GENERAL_MEDIA,
  ]),
  [USER_ROLES.INDIVIDUAL]: new Set([
    UPLOAD_FOLDERS.PROFILES,
    UPLOAD_FOLDERS.JOB_POSTERS,
    UPLOAD_FOLDERS.GENERAL_MEDIA,
  ]),
  [USER_ROLES.CORPORATE]: new Set([
    UPLOAD_FOLDERS.PROFILES,
    UPLOAD_FOLDERS.JOB_POSTERS,
    UPLOAD_FOLDERS.GENERAL_MEDIA,
  ]),
  [USER_ROLES.CONTRACTOR]: new Set([UPLOAD_FOLDERS.PROFILES, UPLOAD_FOLDERS.GENERAL_MEDIA]),
}

const ROLE_DOCUMENT_FOLDERS = {
  [USER_ROLES.ADMIN]: DOCUMENT_FOLDER_SET,
  [USER_ROLES.LABOUR]: new Set([UPLOAD_FOLDERS.KYC_DOCUMENTS]),
  [USER_ROLES.INDIVIDUAL]: new Set([]),
  [USER_ROLES.CORPORATE]: new Set([UPLOAD_FOLDERS.KYC_DOCUMENTS, UPLOAD_FOLDERS.GENERAL_MEDIA]),
  [USER_ROLES.CONTRACTOR]: new Set([UPLOAD_FOLDERS.KYC_DOCUMENTS, UPLOAD_FOLDERS.GENERAL_MEDIA]),
}

export function listFoldersForRole(role, kind = 'media') {
  const map = kind === 'document' ? ROLE_DOCUMENT_FOLDERS : ROLE_MEDIA_FOLDERS
  const allowed = map[role]
  if (!allowed) return []
  return [...allowed]
}

export function assertFolderAllowed(role, folder, kind = 'media') {
  const set = kind === 'document' ? DOCUMENT_FOLDER_SET : MEDIA_FOLDER_SET
  if (!set.has(folder)) {
    const err = new Error(`Invalid folder "${folder}" for ${kind} upload`)
    err.statusCode = 400
    err.code = 'INVALID_FOLDER'
    throw err
  }
  const roleFolders = listFoldersForRole(role, kind)
  if (!roleFolders.includes(folder)) {
    const err = new Error(`You cannot upload to folder "${folder}"`)
    err.statusCode = 403
    err.code = 'FOLDER_FORBIDDEN'
    throw err
  }
}

export function folderCatalogue() {
  return {
    rootPrefix: UPLOAD_ROOT_PREFIX,
    media: [...MEDIA_FOLDER_SET],
    documents: [...DOCUMENT_FOLDER_SET],
    byRole: {
      admin: {
        media: listFoldersForRole(USER_ROLES.ADMIN, 'media'),
        documents: listFoldersForRole(USER_ROLES.ADMIN, 'document'),
      },
      labour: {
        media: listFoldersForRole(USER_ROLES.LABOUR, 'media'),
        documents: listFoldersForRole(USER_ROLES.LABOUR, 'document'),
      },
      individual: {
        media: listFoldersForRole(USER_ROLES.INDIVIDUAL, 'media'),
        documents: listFoldersForRole(USER_ROLES.INDIVIDUAL, 'document'),
      },
      corporate: {
        media: listFoldersForRole(USER_ROLES.CORPORATE, 'media'),
        documents: listFoldersForRole(USER_ROLES.CORPORATE, 'document'),
      },
      contractor: {
        media: listFoldersForRole(USER_ROLES.CONTRACTOR, 'media'),
        documents: listFoldersForRole(USER_ROLES.CONTRACTOR, 'document'),
      },
    },
  }
}
