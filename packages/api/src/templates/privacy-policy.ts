/**
 * Privacy policy templates for GDPR, CCPA, and DPA compliance.
 * Templates contain {{STORE_NAME}} placeholder for auto-fill.
 */

// HIGH #1 FIX + MEDIUM #2 FIX: Sanitize and validate storeName to prevent XSS and DoS
function sanitizeStoreName(storeName?: string): string {
  if (!storeName || typeof storeName !== 'string') {
    return '{{STORE_NAME}}'
  }

  // Limit length to prevent DoS via extremely long strings
  const MAX_STORE_NAME_LENGTH = 100
  const trimmed = storeName.trim()
  if (trimmed.length > MAX_STORE_NAME_LENGTH) {
    return '{{STORE_NAME}}'
  }

  // Remove all HTML tags and special characters that could cause XSS
  // Only allow alphanumeric, spaces, hyphens, underscores, and dots
  const sanitized = trimmed.replace(/[^a-zA-Z0-9\s\-_.]/g, '')

  if (sanitized.length === 0) {
    return '{{STORE_NAME}}'
  }

  return sanitized
}

export function getGdprTemplate(storeName?: string): string {
  const name = sanitizeStoreName(storeName)
  return `PRIVACY POLICY — VIRTUAL TRY-ON SERVICE

Effective Date: [INSERT DATE]
Store: ${name}
Data Processor: WearOn (wearon.app)

1. DATA CONTROLLER
${name} ("we", "us", "our") is the data controller for personal data collected through the virtual try-on feature powered by WearOn.

2. DATA COLLECTED
We collect the following personal data when you use the virtual try-on feature:
- Photographs: Uploaded by you for virtual try-on processing.
- Body measurements (if applicable): Derived from photos for size recommendation.
- Email address (resell mode only): Used for credit balance tracking.

3. PURPOSE OF PROCESSING
Your data is processed solely for the purpose of providing the virtual try-on experience — generating images of you wearing selected products.
Legal basis: Consent (Article 6(1)(a) GDPR). You provide explicit consent by uploading your photo and initiating the try-on process.

4. DATA RETENTION
- All uploaded photos and generated images are automatically deleted within 6 hours of processing.
- No photos or generated images are stored long-term on our servers.
- Generated images are available for download to your device during the 6-hour window.

5. THIRD-PARTY DATA PROCESSING
Your photos are processed by the following third parties:
- WearOn (wearon.app): Acts as data processor. Handles image processing pipeline and temporary storage.
- OpenAI: Acts as sub-processor. Processes images for AI-powered virtual try-on generation. Subject to OpenAI's data processing terms.

Neither WearOn nor OpenAI retains your photos beyond the processing window.

6. DATA SUBJECT RIGHTS
Under GDPR, you have the right to:
- Access: Request a copy of your personal data.
- Rectification: Request correction of inaccurate data.
- Erasure: Request deletion of your data (photos are auto-deleted within 6 hours).
- Restriction: Request restriction of processing.
- Portability: Receive your data in a structured, machine-readable format.
- Objection: Object to processing of your data.
- Withdraw Consent: Withdraw consent at any time without affecting prior processing.

To exercise these rights, contact: [INSERT CONTACT EMAIL]

7. INTERNATIONAL TRANSFERS
Your data may be transferred to servers outside the EEA for processing. Appropriate safeguards (Standard Contractual Clauses) are in place.

8. DATA SECURITY
We implement appropriate technical and organizational measures including encryption in transit (TLS), access controls, and automated deletion to protect your data.

9. CONTACT
Data Protection Officer / Privacy Contact: [INSERT CONTACT EMAIL]
Supervisory Authority: You may lodge a complaint with your local data protection authority.`
}

export function getCcpaTemplate(storeName?: string): string {
  const name = sanitizeStoreName(storeName)
  return `PRIVACY DISCLOSURE — CALIFORNIA CONSUMER PRIVACY ACT (CCPA)

Effective Date: [INSERT DATE]
Store: ${name}
Service Provider: WearOn (wearon.app)

NOTICE AT COLLECTION

1. CATEGORIES OF PERSONAL INFORMATION COLLECTED
When you use the virtual try-on feature, we collect:
- Biometric Information: Photographs uploaded for virtual try-on processing. These may contain facial features and body measurements.
- Identifiers: Email address (resell mode only, for credit balance tracking).

2. PURPOSE OF COLLECTION
Personal information is collected and used solely to:
- Provide the virtual try-on experience (generating images of you wearing products).
- Process size recommendations (if applicable).
- Track credit balances (resell mode, email-based).

3. SALE OR SHARING OF PERSONAL INFORMATION
We do NOT sell your personal information.
We do NOT share your personal information for cross-context behavioral advertising.
Your photos are shared with WearOn and OpenAI solely for processing the virtual try-on service.

4. RETENTION
All uploaded photos and generated images are automatically deleted within 6 hours. No biometric data is retained beyond the processing window.

5. YOUR RIGHTS UNDER CCPA
As a California resident, you have the right to:
- Right to Know: Request what personal information we collect, use, and disclose.
- Right to Delete: Request deletion of your personal information. Note: Photos are auto-deleted within 6 hours.
- Right to Opt-Out of Sale: We do not sell personal information; no opt-out is required.
- Right to Non-Discrimination: We will not discriminate against you for exercising your rights.
- Right to Correct: Request correction of inaccurate personal information.

6. HOW TO EXERCISE YOUR RIGHTS
Submit a verifiable consumer request to: [INSERT CONTACT EMAIL]
We will respond within 45 days of receiving your request.

7. THIRD-PARTY SERVICE PROVIDERS
- WearOn (wearon.app): Processes images for virtual try-on. Acts as a service provider under CCPA.
- OpenAI: Processes images for AI generation. Acts as a service provider under CCPA.

8. CONTACT
Privacy inquiries: [INSERT CONTACT EMAIL]`
}

export function getDpaTemplate(storeName?: string): string {
  const name = sanitizeStoreName(storeName)
  return `DATA PROCESSING AGREEMENT (DPA)

Effective Date: [INSERT DATE]

PARTIES:
- Data Controller: ${name} ("Store", "Controller")
- Data Processor: WearOn (wearon.app) ("Processor")
- Sub-Processor: OpenAI ("Sub-Processor")

1. SCOPE AND PURPOSE
This DPA governs the processing of personal data by the Processor on behalf of the Controller in connection with the virtual try-on service.

2. DATA FLOW
Controller (${name}) → Processor (WearOn) → Sub-Processor (OpenAI)

a) Shopper uploads photo via ${name}'s storefront.
b) Photo is transmitted to WearOn's processing pipeline via secure API (TLS 1.2+).
c) WearOn forwards image to OpenAI for AI-powered virtual try-on generation.
d) Generated image is returned to WearOn, stored temporarily (max 6 hours).
e) Shopper downloads generated image. All copies are auto-deleted within 6 hours.

3. CATEGORIES OF DATA PROCESSED
- Photographs (biometric data)
- Body measurements derived from photos (if size recommendation is used)
- Email addresses (resell mode only)

4. DURATION OF PROCESSING
Processing occurs in real-time. All personal data is automatically deleted within 6 hours of upload.

5. PROCESSOR OBLIGATIONS
The Processor (WearOn) shall:
a) Process data only on documented instructions from the Controller.
b) Ensure persons authorized to process data are bound by confidentiality.
c) Implement appropriate technical and organizational security measures.
d) Not engage another processor without prior authorization (OpenAI is authorized as sub-processor).
e) Assist the Controller with data subject requests.
f) Delete all personal data within 6 hours of processing completion.
g) Make available all information necessary to demonstrate compliance.

6. SUB-PROCESSOR (OpenAI)
a) OpenAI is authorized as a sub-processor for image generation.
b) OpenAI's data processing is governed by OpenAI's enterprise data processing terms.
c) OpenAI does not retain uploaded images beyond the API request lifecycle.
d) The Processor shall notify the Controller of any intended changes to sub-processors.

7. SECURITY MEASURES
- Encryption in transit: TLS 1.2+ for all data transfers.
- Encryption at rest: AES-256 for temporary storage.
- Access controls: Role-based access, API key authentication.
- Automated deletion: 6-hour TTL on all uploaded and generated images.
- Audit logging: All processing events are logged for accountability.

8. DATA BREACH NOTIFICATION
a) The Processor shall notify the Controller without undue delay (and within 72 hours) of becoming aware of a personal data breach.
b) Notification shall include: nature of the breach, categories of data affected, likely consequences, and measures taken.

9. DATA SUBJECT RIGHTS
The Processor shall assist the Controller in responding to data subject requests (access, rectification, erasure, restriction, portability, objection) within the required timeframes.

10. AUDIT
The Controller has the right to conduct audits of the Processor's compliance with this DPA, subject to reasonable notice and confidentiality obligations.

11. TERMINATION
Upon termination, the Processor shall delete all personal data processed on behalf of the Controller, unless retention is required by law.

12. GOVERNING LAW
This DPA is governed by the laws of [INSERT JURISDICTION].

SIGNATURES:

Controller (${name}): ___________________________  Date: __________
Processor (WearOn):  ___________________________  Date: __________`
}

export const PLUGIN_PRIVACY_DISCLOSURE =
  'Your photo is processed by WearOn and deleted within 6 hours. Photos are sent to our AI provider (OpenAI) for virtual try-on generation. No images are stored permanently.'
