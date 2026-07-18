# Admin Booking API Documentation

The Admin Booking API provides endpoints for platform administrators to manage bookings on LabourChowk.

**Base URL**: `/api/v1/admin/bookings`
**Authentication**: Requires Admin JWT Token

---

## 1. Get All Bookings

Retrieve a paginated list of all bookings. Can be filtered by status.

- **Endpoint**: `GET /`
- **Query Parameters**:
  - `page` (optional) - Page number (default: 1)
  - `limit` (optional) - Number of items per page (default: 10)
  - `status` (optional) - Filter by booking status (e.g., `CREATED`, `ASSIGNED`, `COMPLETED`)

**Response Example (200 OK)**
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "_id": "60d21b4667d0d8992e610c85",
        "status": "CREATED",
        "type": "INSTANT",
        "totalAmount": 1050,
        "userId": {
          "_id": "...",
          "fullName": "John Doe",
          "phone": "9876543210"
        },
        "serviceId": {
          "_id": "...",
          "name": "Plumbing Repair",
          "basePrice": 500
        }
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  }
}
```

---

## 2. Get Booking Details

Retrieve full details of a specific booking by its ID.

- **Endpoint**: `GET /:id`
- **Path Parameters**:
  - `id` - The unique Booking ID.

**Response Example (200 OK)**
```json
{
  "success": true,
  "data": {
    "booking": {
      "_id": "60d21b4667d0d8992e610c85",
      "status": "ASSIGNED",
      "type": "SCHEDULED",
      "scheduledAt": "2023-10-15T10:00:00Z",
      "userId": { "fullName": "John Doe", "phone": "9876543210" },
      "laborId": { "fullName": "Jane Smith", "phone": "1234567890" },
      "basePrice": 1000,
      "platformFee": 50,
      "taxes": 0,
      "totalAmount": 1050,
      "commissionAmount": 100,
      "laborShare": 900
    }
  }
}
```

---

## 3. Update Booking Status (Admin Override)

Forcefully update the status of a booking without requiring OTPs. Useful for dispute resolution or manual cancellations.

- **Endpoint**: `PATCH /:id/status`
- **Body**:
  ```json
  {
    "status": "CANCELLED"
  }
  ```
  *(Valid statuses: 'DRAFT', 'CREATED', 'BROADCASTING', 'ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED')*

**Response Example (200 OK)**
```json
{
  "success": true,
  "message": "Booking status updated successfully",
  "data": {
    "booking": {
      "_id": "60d21b4667d0d8992e610c85",
      "status": "CANCELLED"
    }
  }
}
```

---

## 4. Manually Assign Labourer

Allow an administrator to manually assign a specific labourer to a booking.

- **Endpoint**: `PATCH /:id/assign`
- **Body**:
  ```json
  {
    "laborId": "60d21b4998d0d8992e610c99"
  }
  ```

**Response Example (200 OK)**
```json
{
  "success": true,
  "message": "Labourer assigned manually successfully",
  "data": {
    "booking": {
      "_id": "60d21b4667d0d8992e610c85",
      "status": "ASSIGNED",
      "laborId": {
        "_id": "60d21b4998d0d8992e610c99",
        "fullName": "Jane Smith"
      }
    }
  }
}
```
