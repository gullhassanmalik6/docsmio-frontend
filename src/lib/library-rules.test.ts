import { describe, expect, it } from 'vitest'
import { classifyFileName, folderMoveError, libraryFileError, uniqueFileName } from '@/lib/library-rules'
import { shareFallbackNote } from '@/lib/library-share'

describe('document library rules', () => {
  it('suggests a folder from the filename and leaves ambiguous files uncategorized', () => {
    expect(classifyFileName('ali-marksheet-2024.pdf').folderKey).toBe('educational')
    expect(classifyFileName('passport-scan.jpg').folderKey).toBe('identification')
    expect(classifyFileName('experience letter.pdf').folderKey).toBe('career')
    expect(classifyFileName('office-receipt.png').folderKey).toBe('financial')
    expect(classifyFileName('notes.pdf').folderKey).toBe('uncategorized')
    expect(classifyFileName('notes.pdf').method).toBe('filename')
    expect(classifyFileName('academic certificate transcript.pdf').confidence).toBe('high')
  })

  it('keeps both copies when a filename already exists', () => {
    expect(uniqueFileName('passport.pdf', ['Passport.pdf'])).toBe('passport (2).pdf')
    expect(uniqueFileName('passport.pdf', [])).toBe('passport.pdf')
  })

  it('rejects unsupported and oversized files before they are stored', () => {
    expect(libraryFileError({ name: 'notes.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 100 })).toMatch(/PDF, JPG/)
    expect(libraryFileError({ name: 'huge.pdf', type: 'application/pdf', size: 51 * 1024 * 1024 })).toMatch(/50 MB/)
    expect(libraryFileError({ name: 'photo.jpg', type: 'image/jpeg', size: 1200 })).toBeNull()
  })

  it('refuses to move a folder into itself or a descendant', () => {
    const folders = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
    ]
    expect(folderMoveError(folders, 'a', 'a')).toMatch(/itself/)
    expect(folderMoveError(folders, 'a', 'c')).toMatch(/subfolders/)
    expect(folderMoveError(folders, 'c', 'a')).toBeNull()
  })

  it('does not claim a file was attached when the browser cannot hand it off', () => {
    expect(shareFallbackNote('whatsapp')).toMatch(/downloaded/)
    expect(shareFallbackNote('whatsapp')).toMatch(/cannot place the file/)
    expect(shareFallbackNote('email')).toMatch(/cannot carry the file/)
    expect(shareFallbackNote('other')).toMatch(/downloaded/)
  })
})
