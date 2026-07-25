# BuildMart Vendor Enquiry (Leads) API Documentation

This document outlines the API endpoints and data flow for the BuildMart Enquiry system. This system allows customers and laborers to send product quote requests, which are directly routed to the vendor who listed the specific product.

## Schema Overview: `BuildMartLead`
A lead is generated whenever a user enquires about a BuildMart product. Key fields include:
- `productId` (String): ID of the BuildMart product.
- `vendorId` (ObjectId): References the `User` model (the vendor owning the product).
- `name`, `phone`, `siteLocation`, `quantity` (String): Details provided by the enquirer.
- `status` (String): Current state of the enquiry (`'new'`, `'contacted'`, `'quoted'`, `'won'`, `'lost'`).
- `whatsappUrl` (String): A dynamically generated field (not in DB) returned to vendors for easy 1-click messaging.

---

## 1. Customer / App User Endpoints

### Submit a Quote/Enquiry
**Endpoint:** `POST /api/v1/buildmart/quotes`
**Auth Required:** Yes (Any App Role)

**Description:**
When a user submits this form on a BuildMart product page, the backend automatically finds the product by `productId`, extracts the `vendorId` of the product owner, and associates the new lead with that vendor.

**Request Body:**
```json
{
  "productId": "cement-bag-50kg",
  "productName": "UltraTech Cement 50kg",
  "variantId": "v1",
  "variantLabel": "Standard",
  "name": "Rahul Builder",
  "phone": "9876543210",
  "siteLocation": "Andheri West, Mumbai",
  "quantity": "50 Bags",
  "deliveryDate": "2026-08-01",
  "notes": "Please deliver in the morning"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Quote request submitted",
  "data": {
    "lead": {
      "_id": "6a5...",
      "productId": "cement-bag-50kg",
      "vendorId": "6b7...", // Automatically injected by the backend
      "status": "new",
      // ... other fields
    }
  }
}
```

---

## 2. Vendor Endpoints

### Get Vendor Enquiries (Leads)
**Endpoint:** `GET /api/v1/vendor/buildmart/enquiries`
**Auth Required:** Yes (Role: `CONTRACTOR`)

**Description:**
Fetches all product enquiries that are linked to the currently logged-in vendor's `vendorId`. Supports pagination and status filtering. 

*Key Feature:* The backend dynamically injects a `whatsappUrl` for each lead, allowing the vendor to click a button on the frontend to instantly open WhatsApp with a pre-filled message to the customer.

**Query Parameters:**
- `page` (optional): Default `1`
- `limit` (optional): Default `20`
- `status` (optional): Filter by `new`, `contacted`, `quoted`, `won`, `lost`.

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "_id": "6a5...",
        "productId": "cement-bag-50kg",
        "name": "Rahul Builder",
        "phone": "9876543210",
        "status": "new",
        "whatsappUrl": "https://wa.me/919876543210?text=Hi%2C%20regarding%20your%20BuildMart%20enquiry..."
      }
    ],
    "total": 1,
    "page": 1,
    "pages": 1
  }
}
```

### Update Enquiry Status
**Endpoint:** `PATCH /api/v1/vendor/buildmart/enquiries/:id/status`
**Auth Required:** Yes (Role: `CONTRACTOR`)

**Description:**
Allows the vendor to update the status of their lead to reflect progress in the sales pipeline. Security checks ensure a vendor cannot update a lead belonging to someone else.

**Request Body:**
```json
{
  "status": "contacted" // Allowed values: 'new', 'contacted', 'quoted', 'won', 'lost'
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Enquiry status updated",
  "data": {
    "lead": { ... }
  }
}
```
**Error Responses:**
- `400 Bad Request`: If an invalid status is provided.
- `404 Not Found`: If the lead does not exist or does not belong to the requesting vendor.

---

## 3. Admin Endpoints

### List All Leads
**Endpoint:** `GET /api/v1/admin/buildmart/leads`
**Auth Required:** Yes (Role: `ADMIN`)

**Description:**
Allows the global admin to monitor all quote requests across the platform. The `vendorId` field is populated to show the admin exactly which vendor is handling the request.

**Query Parameters:**
- `page` (optional)
- `limit` (optional)
- `status` (optional)
- `search` (optional): Searches across customer name, phone, product name, or site location.

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "_id": "6a5...",
        "productId": "cement-bag-50kg",
        "vendorId": {
          "_id": "6b7...",
          "fullName": "Super Hardware Store",
          "phone": "9998887776",
          "email": "contact@superhardware.com"
        },
        "status": "new"
      }
    ],
    "total": 1,
    "page": 1,
    "pages": 1
  }
}
```

### Update Lead Status (Admin)
**Endpoint:** `PATCH /api/v1/admin/buildmart/leads/:id`
**Auth Required:** Yes (Role: `ADMIN`)

**Description:**
The admin can manually override or update a lead's status if required. Same validation and rules apply as the vendor update endpoint.
