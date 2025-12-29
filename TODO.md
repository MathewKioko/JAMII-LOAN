# Special Approval Feature Implementation

## Backend Changes
- [x] Update Loan model: Add `isSpecialApproved` field
- [x] Add `specialApproveLoan` function in adminController.js
- [x] Add `/api/admin/loan/:id/special-approve` route in adminRoutes.js
- [x] Update notifications for special approvals

## Frontend Changes
- [x] Update LoanContext.jsx: Add `specialApproveLoanAdmin` function
- [x] Update AdminDashboard.jsx: Add special approve button
- [x] Update LoanQueueCard.jsx: Add special approve button

## Testing
- [x] Test special approval functionality
- [x] Verify notifications are sent correctly
- [x] Ensure only admins can perform special approvals
