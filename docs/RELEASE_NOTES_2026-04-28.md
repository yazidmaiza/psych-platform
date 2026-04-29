# Release Notes

Date: 2026-04-28
Previous Release: 2026-03-29

This document summarizes the changes and new features implemented in the `psych-platform` since March 29, 2026.

## 1) AI Face Recognition & Verification
A major security enhancement has been integrated to verify the identity of psychologists and administrators.
- **Core Technology**: Integrated `face-api.js` for browser-based face detection and recognition.
- **Models Added**: Included weights and manifests for `ssd_mobilenetv1`, `face_landmark_68`, and `face_recognition`.
- **Backend Infrastructure**: 
  - New `verificationController` and `faceVerificationService`.
  - Added `faceDescriptor` field to the Psychologist model for storing biometric signatures.
- **UI Integration**:
  - Face capture and verification added to the **Login** and **Register** flows.
  - Enhanced **Psychologist Setup** with identity verification steps.
- **Documentation**: New [face-verification.md](file:///c:/Users/Mega-PC/psych-platform/docs/face-verification.md) detailing the implementation.

## 2) Gemini AI Assistant Bot
- **Floating Assistant**: Implemented an always-available floating AI assistant powered by **Google Gemini**.
- **Context Awareness**: Provides real-time guidance to patients and psychologists regarding platform features.
- **Components**: New `AssistantBot.jsx` integrated into the main application layout.

## 3) Internationalization & Regional Features
- **Multilingual Support**: Added i18n support for **English**, **French (fr)**, and **Arabic (ar)**.
- **Location-Based Search**:
  - Integrated maps for visualizing psychologist locations.
  - Role-based live search on the landing page to quickly filter by specialty or location.

## 4) Communication & Interaction
- **Voice Messaging**: Users can now record and send voice messages within session chats.
- **Unified Session UI**: Continued refinements to the dark-glass session interface, improving tab switching and message stability.
- **Chatbot Logic**: Enhanced the session-type-specific system prompts and incremental message saving.

## 5) Security & UI/UX Refinements
- **Security Hardening**: General security updates and dependency audits.
- **UX Fixes**: Refined the layout for the Home Page, Login, and Registration to ensure a premium feel.
- **Calendar Stability**: Fixed bugs related to slot availability and booking confirmations.

## 6) Files Modified (Snapshot)
- `docs/face-verification.md` [NEW]
- `server/src/services/faceVerificationService.js` [NEW]
- `client/src/components/AssistantBot.jsx` [NEW]
- `client/src/locales/*.json` [NEW]
- `client/src/pages/SessionPage.jsx` [MODIFIED]
- `server/src/models/Psychologist.js` [MODIFIED]
