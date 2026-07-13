import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { USER_ROLES, CORPORATE_STATUS, KYC_STATUS } from '../constants/roles.js'
import { BILLING_MODE } from '../constants/workforceConstants.js'
const documentSchema = new mongoose.Schema(
  {
    documentType: { type: String, trim: true },
    label: { type: String, trim: true },
    url: { type: String, maxlength: 2048 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const corporateProfileSchema = new mongoose.Schema(
  {
    companyName: { type: String, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    panNumber: { type: String, trim: true, uppercase: true },
    cinNumber: { type: String, trim: true, uppercase: true },
    registeredAddress: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true, maxlength: 6 },
    contactPersonName: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true, maxlength: 2048 },
    status: {
      type: String,
      enum: Object.values(CORPORATE_STATUS),
      default: CORPORATE_STATUS.PENDING,
    },
    billingMode: {
      type: String,
      enum: Object.values(BILLING_MODE),
      default: BILLING_MODE.POSTPAID,
    },
    creditLimit: { type: Number, min: 0 },
    documents: [documentSchema],
    /** Set when user submits docs for admin review */
    documentsSubmittedAt: Date,
    reviewedAt: Date,
    reviewNote: String,
  },
  { _id: false },
)

const labourProfileSchema = new mongoose.Schema(
  {
    kycStatus: {
      type: String,
      enum: Object.values(KYC_STATUS),
      default: KYC_STATUS.PENDING,
    },
    aadhaarMasked: String,
    panMasked: String,
    /** When worker submitted Aadhaar/PAN video KYC for admin review */
    kycSubmittedAt: Date,
    /** Cloudinary video URL for manual Aadhaar + PAN review */
    kycVideoUrl: { type: String, maxlength: 2048 },
    kycVideoMeta: {
      publicId: { type: String, maxlength: 512 },
      resourceType: { type: String, maxlength: 32 },
      format: { type: String, maxlength: 32 },
      bytes: Number,
      duration: Number,
      uploadedAt: Date,
    },
    /** Cloudinary HTTPS URLs (preferred) */
    kycFrontImageUrl: { type: String, maxlength: 2048 },
    kycBackImageUrl: { type: String, maxlength: 2048 },
    /** Legacy base64 data URLs — kept for older submissions */
    kycFrontImageDataUrl: { type: String },
    kycBackImageDataUrl: { type: String },
    kycReviewNote: { type: String, trim: true, maxlength: 500 },
    /** @deprecated prefer categoryIds — kept for backward compatibility */
    skills: [{ type: String, trim: true }],
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategory' }],
    subcategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabourSubcategory' }],
    minAcceptedPrice: { type: Number, min: 0 },
    maxAcceptedPrice: { type: Number, min: 0 },
    availabilityStatus: {
      type: String,
      enum: ['available', 'busy', 'offline'],
      default: 'available',
    },
    currentLatitude: { type: Number },
    currentLongitude: { type: Number },
    lastLocationUpdatedAt: { type: Date },
  },
  { _id: false },
)

const contractorProfileSchema = new mongoose.Schema(
  {
    businessName: { type: String, trim: true },
    /** sole_proprietor | partnership_firm | labour_contractor | etc. */
    vendorType: { type: String, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    panNumber: { type: String, trim: true, uppercase: true },
    businessAddress: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true, maxlength: 6 },
    contactPersonName: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true, maxlength: 10 },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    documents: [documentSchema],
    documentsSubmittedAt: Date,
    reviewedAt: Date,
    reviewNote: String,
  },
  { _id: false },
)

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      minlength: 10,
      maxlength: 10,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
    },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
      index: true,
    },
    fullName: { type: String, trim: true },
    /** Optional profile photo (https URL); shown in app header when set */
    profileImageUrl: { type: String, maxlength: 2048 },
    isActive: { type: Boolean, default: true },
    isPhoneVerified: { type: Boolean, default: false },
    lastLoginAt: Date,
    savedAddress: {
      text: { type: String, trim: true, maxlength: 500 },
      lat: Number,
      lng: Number
    },
    /** When labour is onboarded under a vendor/contractor */
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    corporateProfile: corporateProfileSchema,
    labourProfile: labourProfileSchema,
    contractorProfile: contractorProfileSchema,
  },
  { timestamps: true },
)

userSchema.methods.comparePassword = async function comparePassword(plain) {
  if (!this.passwordHash) return false
  return bcrypt.compare(plain, this.passwordHash)
}

userSchema.methods.toSafeObject = function toSafeObject(options = {}) {
  const o = this.toObject({ virtuals: true })
  delete o.passwordHash
  if (!options.includeLabourKycImages && o.labourProfile) {
    const lp = { ...o.labourProfile }
    delete lp.kycFrontImageDataUrl
    delete lp.kycBackImageDataUrl
    delete lp.kycFrontImageUrl
    delete lp.kycBackImageUrl
    o.labourProfile = lp
  }
  return o
}

export const User = mongoose.model('User', userSchema)
