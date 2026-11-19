# Emirgan university preparation archive

The new panel section appears only after /api/university-vault/access verifies
the owner. It uses the existing approved, non-banned session authenticator and
device guard. Administrator status or a matching username never grants access.

Set KAPSAPP_UNIVERSITY_EMIRGAN_ID to the verified production account ID. If
the private travel planner already pinned Emirgan, its identity can be reused.
The first authorized request pins the university owner independently. Changing
the configuration to another ID fails closed.

Before first activation with local SQLite, from the updated checkout run:

    cd /var/www/KapsApp
    python3 scripts/configure-university-vault.py --database /var/www/KapsApp/local.db --env /var/www/KapsApp/.env --backup-dir /var/backups/kapsapp

The script verifies the source, uses SQLite online backup including WAL contents,
checks backup integrity and atomically writes the owner ID into the existing
environment file. Restart the existing PM2 application after building. For a
remote libSQL/Turso deployment, back up the actual remote database with its
supported mechanism and set the verified ID in the actual runtime environment.

Two additive tables and one index store the owner and versioned records. Files
are private database BLOBs, not public uploads. Database backup includes them.
Every download requires authentication and forces attachment disposition and
nosniff headers. Files are never executed or served inline. Accepted formats are
PDF, PNG, JPG, DOCX, XLSX, ODT and TXT with basic signature validation. This
does not provide antivirus scanning.

Limits are 8 MB per file, 512 MB total attachment storage and 3,000 folders/records.
Each record has one current attachment. Uploading another replaces that attachment.
For multiple attachments or historical versions, use separately named records.
Deletion is permanent. Empty a folder or move its children before deleting it.
Unlink a document from its application records before deleting it.

Folder moves reject cycles. Edits, replacement uploads and deletes use versions.
The open editor keeps its text on failure. Metadata is saved before its
attachment. If upload fails, metadata stays and the editor reports the failure.
Polling refreshes the list every ten seconds without replacing drafts.

Sections cover CV, certificates, activities/projects, education, languages,
letters, applications, identity and other documents. Application records link
existing evidence records and their statuses. CV fields export escaped HTML
for browser print-to-PDF. The archive does not submit university applications.

Research informing common documents and application-specific CV/letter versions:
- https://www.uni-assist.de/en/how-to-apply/apply-online/uploading-documents/
- https://www.uni-assist.de/en/how-to-apply/plan-your-application/other-documents/
- https://www.rwth-aachen.de/global/show_document.asp?download=1&id=aaaaaaaaaifbdao

Requirements and deadlines are entered for each actual programme.
Production identity binding, backup and physical-phone verification need the VDS.

Verification commands: npm run build; npm run lint; node --import tsx --test tests/university.test.ts; node --import tsx tests/university.browser.ts; node --import tsx tests/university.production.browser.ts.
