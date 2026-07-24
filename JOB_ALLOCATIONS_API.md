# Job Allocations API Documentation (Supply Chain)

This document covers the complete workflow for Job Allocations across the **Corporate**, **Admin**, and **Vendor** panels.

---

## 1. Corporate Panel (Demand Generation)

Corporate users generate the demand by creating Workforce Requests.

### `POST /api/v1/workforce/requests`
Creates a new Workforce Request.

**Request Payload:**
```json
{
  "startDate": "2026-08-01",
  "endDate": "2026-08-30",
  "scheduleType": "daily",
  "locationText": "Andheri West, Mumbai",
  "notes": "Need experienced masons for residential project",
  "billingMode": "per_hour",
  "lines": [
    {
      "categoryId": "60d5ec49f1b2c8b1f8c8e1a1",
      "quantity": 5
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "request": {
      "_id": "60d5ec49...",
      "reference": "CR-001",
      "status": "pending_review",
      "startDate": "2026-08-01T00:00:00.000Z",
      ...
    }
  }
}
```

### `GET /api/v1/workforce/requests`
List all workforce requests created by the logged-in corporate user.

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "_id": "...",
        "reference": "CR-001",
        "status": "open",
        "startDate": "2026-08-01T00:00:00.000Z"
      }
    ]
  }
}
```

### `GET /api/v1/workforce/requests/:id`
Get full details of a specific request, including its allocation status.

---

## 2. Admin Panel (Allocation & Routing)

Admins review requests and allocate them to specific vendors.

### `GET /api/v1/admin/workforce/requests`
List all workforce requests from all clients. Used by admin to find open requests that need allocation.

### `POST /api/v1/admin/workforce/allocations`
Assign a specific Workforce Request to a specific Vendor. This makes the job appear on the Vendor's dashboard.

**Request Payload:**
```json
{
  "requestId": "60d5ec49...", 
  "vendorId": "60d5fa99...",
  "notes": "Please deploy your best masons"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allocation": {
      "_id": "...",
      "requestId": "60d5ec49...",
      "vendorId": "60d5fa99...",
      "adminId": "...",
      "vendorAcceptedAt": null,
      "vendorRejectedAt": null
    }
  }
}
```

---

## 3. Vendor Panel (Supply Execution)

Vendors view the jobs allocated to them by the Admin and choose to accept or reject them.

### `GET /api/v1/vendor/jobs`
List all jobs assigned to this vendor by the Admin.

**Response:**
```json
{
  "success": true,
  "data": {
    "allocations": [
      {
        "_id": "...",
        "vendorAcceptedAt": null,
        "vendorRejectedAt": null,
        "createdAt": "...",
        "requestId": {
          "reference": "WFR-001",
          "status": "open",
          "locationText": "Andheri West, Mumbai",
          "startDate": "2026-08-01",
          "endDate": "2026-08-30"
        }
      }
    ]
  }
}
```

### `GET /api/v1/vendor/jobs/:id`
Get full details of a specific job allocation to see requirements and client details.

**Response:**
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
        "lines": [{ "categoryId": "...", "quantity": 5 }]
      }
    }
  }
}
```

### `POST /api/v1/vendor/jobs/:id/accept`
Accept the allocated job and commit to deploying the crew.
* **Rule:** Blocked if `vendorRejectedAt` is already set.

**Response:**
```json
{
  "success": true,
  "data": {
    "allocation": {
      "_id": "...",
      "vendorAcceptedAt": "2026-07-21T10:00:00.000Z"
    }
  }
}
```

### `POST /api/v1/vendor/jobs/:id/reject`
Decline the allocated job (e.g., if crew is unavailable).
* **Rule:** Blocked if `vendorAcceptedAt` or `vendorRejectedAt` is already set.

**Response:**
```json
{
  "success": true,
  "message": "Job rejected successfully",
  "data": {
    "allocation": {
      "_id": "...",
      "vendorRejectedAt": "2026-07-21T10:05:00.000Z"
    }
  }
}
```
