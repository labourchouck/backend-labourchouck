# Vendor Panel — Backend API Reference

Base URL: `/vendor`

All routes require:
- `Authorization: Bearer <token>` header
- User role must be `contractor`

Routes marked with 🔒 additionally require `verificationStatus === 'approved'`.

---

## 1. Auth, Profile & KYC

### `GET /vendor/me`
Vendor ki apni profile aur KYC verification details lane ke liye.

**Response**
```json
{
  "success": true,
  "data": {
    "user": { "_id": "...", "fullName": "...", "contractorProfile": { ... } },
    "verification": {
      "checklist": [...],
      "requiredDone": 3,
      "requiredTotal": 4,
      "readyToSubmit": false
    }
  }
}
```

---

### `PATCH /vendor/me`
Business details update karne ke liye (name, address, type, PAN, GST etc).
> ❌ Blocked if `verificationStatus === 'approved'`

**Request Body**
```json
{
  "businessName": "Kumar Contractors Pvt Ltd",
  "vendorType": "labour_contractor",
  "panNumber": "ABCDE1234F",
  "gstNumber": "22AAAAA0000A1Z5",
  "businessAddress": "123, Industrial Area",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "contactPersonName": "Rajesh Kumar",
  "contactEmail": "rajesh@example.com",
  "contactPhone": "9876543210"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "verification": { "checklist": [...], "readyToSubmit": false }
  }
}
```

---

### `POST /vendor/documents`
KYC document upload karne ke liye (Aadhaar, PAN, GST, Shop Establishment etc).
> ❌ Blocked if `verificationStatus === 'approved'`

**Request Body**
```json
{
  "documentType": "shop_establishment",
  "label": "Shop & Establishment Certificate",
  "url": "https://cdn.example.com/kyc/doc.pdf"
}
```

**Document Types** (`documentType` enum):
| Value | Label |
|-------|-------|
| `shop_establishment` | Shop & Establishment |
| `gst_certificate` | GST Certificate |
| `pan_card` | PAN Card |
| `aadhaar` | Aadhaar Card |
| `labour_licence` | Labour Licence |
| `other` | Other Document |

**Response**
```json
{ "success": true, "data": { "user": { ... } } }
```

**Error Codes**
| Code | Meaning |
|------|---------|
| `INVALID_DOCUMENT_TYPE` | documentType enum mein nahi hai |
| `DOCUMENT_TYPE_EXISTS` | Same type already uploaded hai |

---

### `DELETE /vendor/documents/:docId`
Galat ya purana document hatane ke liye.
> ❌ Blocked if `documentsSubmittedAt` is set (review mein hai)

**Response**
```json
{ "success": true, "data": { "user": { ... } } }
```

---

### `POST /vendor/verification/submit`
Profile ko admin approval ke liye submit karne ke liye.

**Response**
```json
{
  "success": true,
  "message": "Verification submitted — our team will review your documents shortly",
  "data": { "user": { ... } }
}
```

**Error Codes**
| Code | Meaning |
|------|---------|
| `VERIFICATION_INCOMPLETE` | Required checklist items baaki hain |

---

## 2. Dashboard

### 🔒 `GET /vendor/dashboard`
Home screen ke liye live stats.

**Response**
```json
{
  "success": true,
  "data": {
    "stats": {
      "crewCount": 12,
      "openJobs": 3,
      "activeAssignments": 8
    }
  }
}
```

---

## 3. Crew Management (Workforce)

### 🔒 `GET /vendor/crew`
Vendor se linked sabhi workers ki list.

**Response**
```json
{
  "success": true,
  "data": {
    "crew": [
      {
        "_id": "...",
        "fullName": "Mohan Singh",
        "phone": "9876543210",
        "profileImageUrl": "...",
        "labourProfile": { "skills": [...], "kycStatus": "approved" }
      }
    ]
  }
}
```

---

### 🔒 `POST /vendor/crew/link`
Worker ko link karne ki request. Agar worker kisi aur vendor se linked hai toh OTP bheja jaata hai.

**Request Body**
```json
{ "phone": "9876543210" }
```

**Response (Free worker — direct link nahi, OTP bheja)**
```json
{
  "success": true,
  "data": { "needsOtp": true, "challengeId": "abc123xyz" }
}
```

**Errors**
| Status | Meaning |
|--------|---------|
| 404 | Labour account is phone par nahi mila |
| 400 | Worker pehle se aapki crew mein hai |

---

### 🔒 `POST /vendor/crew/link/verify`
Worker ke phone par aaye OTP ko verify karke transfer pura karna.

**Request Body**
```json
{
  "phone": "9876543210",
  "code": "482910",
  "challengeId": "abc123xyz"
}
```

**Response**
```json
{
  "success": true,
  "data": { "worker": { "_id": "...", "fullName": "..." } }
}
```

**OTP Error Codes**
| Code | Meaning |
|------|---------|
| `INVALID_CHALLENGE` | challengeId galat ya expire |
| `EXPIRED` | OTP expire ho gaya |
| `TOO_MANY_ATTEMPTS` | Zyada attempts |
| `INVALID_CODE` | Galat OTP |

---

### 🔒 `DELETE /vendor/crew/:workerId`
Worker ko apni crew se unlink/remove karna.

**Response**
```json
{ "success": true, "message": "Worker unlinked successfully" }
```

**Error**: 404 if worker is vendor ki crew mein nahi hai.

---

## 4. Job Allocations (Supply)

### 🔒 `GET /vendor/jobs`
Admin dwara assign ki gayi sabhi job allocations.

**Response**
```json
{
  "success": true,
  "data": {
    "allocations": [
      {
        "_id": "...",
        "vendorAcceptedAt": null,
        "vendorRejectedAt": null,
        "deployedAt": null,
        "createdAt": "...",
        "requestId": {
          "reference": "WFR-001",
          "status": "open",
          "locationText": "Andheri West, Mumbai",
          "startDate": "2026-08-01",
          "endDate": "2026-08-30",
          "lines": [{ "description": "Mason", "quantity": 5 }]
        }
      }
    ]
  }
}
```

---

### 🔒 `GET /vendor/jobs/:id`
Kisi ek job ki poori detail.

**Response**
```json
{
  "success": true,
  "data": {
    "allocation": {
      "_id": "...",
      "vendorAcceptedAt": null,
      "vendorRejectedAt": null,
      "requestId": {
        "reference": "WFR-001",
        "status": "open",
        "locationText": "Andheri West, Mumbai",
        "startDate": "2026-08-01",
        "endDate": "2026-08-30",
        "description": "Need experienced masons for residential project",
        "requirements": "Minimum 3 years experience",
        "clientName": "ABC Builders",
        "clientPhone": "9999999999",
        "lines": [{ "description": "Mason", "quantity": 5 }]
      }
    }
  }
}
```

---

### 🔒 `POST /vendor/jobs/:id/accept`
Job accept karna aur crew deploy karna.
> ❌ Blocked if already rejected

**Response**
```json
{
  "success": true,
  "data": { "allocation": { "vendorAcceptedAt": "2026-07-21T...", ... } }
}
```

---

### 🔒 `POST /vendor/jobs/:id/reject`
Job decline karna (agar crew available na ho).
> ❌ Blocked if already accepted or rejected

**Response**
```json
{
  "success": true,
  "message": "Job rejected successfully",
  "data": { "allocation": { "vendorRejectedAt": "2026-07-21T...", ... } }
}
```

---

## 5. Analytics & Insights

### 🔒 `GET /vendor/analytics`
Graph data for past N days (default 30, max 90).

**Query Params**
| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `days` | `30` | `90` | Kitne din ka data chahiye |

**Example**: `GET /vendor/analytics?days=7`

**Response**
```json
{
  "success": true,
  "data": {
    "period": { "days": 30, "since": "2026-06-21T00:00:00.000Z" },
    "summary": {
      "crewSize": 12,
      "totalPresent": 187,
      "totalBillableUnits": 187.5,
      "totalEarned": 250000
    },
    "attendanceChart": [
      { "date": "2026-06-21", "present": 8, "absent": 2, "billableUnits": 8.0 },
      { "date": "2026-06-22", "present": 10, "absent": 0, "billableUnits": 10.0 }
    ],
    "earningsChart": [
      { "month": "2026-06", "totalEarned": 125000, "invoiceCount": 3 },
      { "month": "2026-07", "totalEarned": 125000, "invoiceCount": 2 }
    ]
  }
}
```

---

## 6. Earnings & Settlements

### 🔒 `GET /vendor/settlements`
Admin dwara generate ki gayi invoices ki list.

**Response**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "...",
        "invoiceNumber": "INV-ABC123",
        "status": "paid",
        "total": 50000,
        "subtotal": 44642,
        "gstTotal": 5358,
        "paidAt": "2026-07-15T...",
        "issuedAt": "2026-07-10T...",
        "lines": [{ "description": "Mason", "billableUnits": 20, "ratePerUnit": 800, "amount": 16000 }]
      }
    ]
  }
}
```

---

## 7. Withdrawals (Payout)

### 🔒 `GET /vendor/withdrawals`
Withdrawal history + current wallet balance.

**Response**
```json
{
  "success": true,
  "data": {
    "walletBalance": 15000,
    "withdrawals": [
      {
        "_id": "...",
        "amount": 5000,
        "status": "APPROVED",
        "adminRemarks": "Processed via NEFT",
        "bankDetails": {
          "accountNumber": "123456789",
          "ifscCode": "HDFC0001234",
          "accountHolderName": "Rajesh Kumar",
          "bankName": "HDFC Bank"
        },
        "createdAt": "2026-07-10T..."
      }
    ]
  }
}
```

**Withdrawal Status Values**
| Status | Meaning |
|--------|---------|
| `PENDING` | Admin ne abhi process nahi kiya |
| `APPROVED` | Paise transfer ho gaye |
| `REJECTED` | Admin ne reject kiya (reason `adminRemarks` mein) |

---

### 🔒 `POST /vendor/withdrawals/request`
Wallet balance se bank account mein paise transfer ki request.

**Request Body**
```json
{
  "amount": 5000,
  "bankDetails": {
    "accountNumber": "123456789012",
    "ifscCode": "HDFC0001234",
    "accountHolderName": "Rajesh Kumar",
    "bankName": "HDFC Bank"
  }
}
```

**Response**
```json
{
  "success": true,
  "message": "Withdrawal request submitted — admin will process it shortly",
  "data": { "withdrawal": { "_id": "...", "amount": 5000, "status": "PENDING", ... } }
}
```

**Validation Rules**
- Minimum amount: **₹100**
- Sabhi 4 bank fields required
- Insufficient wallet balance se error

**Error Codes**
| Code | Meaning |
|------|---------|
| `INSUFFICIENT_BALANCE` | Wallet mein itne paise nahi hain |
| `PENDING_EXISTS` | Pehle se ek pending request hai |

---

## Common Error Format

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

## HTTP Status Codes Used

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (validation fail) |
| `403` | Forbidden (wrong role / not approved) |
| `404` | Not Found |
| `409` | Conflict (duplicate) |
| `500` | Server Error |
