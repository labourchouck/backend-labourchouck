

/** @typedef {{ id: string, label: string, size: string, unit: string, retailPrice: number, contractorPrice: number, bulkPrice?: number, moq?: number }} BuildMartVariant */
/** @typedef {{ id: string, name: string, brand: string, categoryId: string, shortDescription: string, description: string, images: string[], specs: { label: string, value: string }[], deliveryInfo: string, availability: 'in_stock' | 'limited' | 'preorder', supplier: { name: string, rating: number, city: string }, variants: BuildMartVariant[], variantCount: number, priceLabel: string, relatedIds?: string[] }} BuildMartProduct */





/** @type {BuildMartProduct[]} */
const BUILDMART_PRODUCTS = [
  {
    id: 'ultratech-opc53',
    name: 'UltraTech Cement OPC 53',
    brand: 'UltraTech',
    categoryId: 'cement',
    shortDescription: 'High-strength OPC 53 Grade for structural RCC work.',
    description:
      'Premium OPC 53 Grade cement suitable for high-rise, bridges, and heavy RCC. Consistent fineness and early strength gain for faster slab cycles.',
    images: [
      'https://images.unsplash.com/photo-1581094797760-3c2f8f4e3b0a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    ],
    specs: [
      { label: 'Grade', value: 'OPC 53' },
      { label: 'IS Code', value: 'IS 269:2015' },
      { label: 'Setting', value: 'Initial ≥ 30 min' },
      { label: 'Packaging', value: 'HDPE bag' },
    ],
    deliveryInfo: 'Site drop within 24–48 hrs · Unloading assist on request',
    availability: 'in_stock',
    supplier: { name: 'BuildMart Aggregators NCR', rating: 4.7, city: 'Delhi NCR' },
    variantCount: 3,
    priceLabel: '₹350/bag',
    variants: [
      { id: 'v25', label: '25 KG', size: '25', unit: 'bag', retailPrice: 350, contractorPrice: 332, bulkPrice: 318, moq: 50 },
      { id: 'v50', label: '50 KG', size: '50', unit: 'bag', retailPrice: 680, contractorPrice: 645, bulkPrice: 620, moq: 30 },
      { id: 'bulk100', label: '100 Bag Bulk', size: '100', unit: 'bags', retailPrice: 31800, contractorPrice: 30500, bulkPrice: 29800, moq: 100 },
    ],
    relatedIds: ['acc-gold', 'jk-super'],
  },
  {
    id: 'acc-gold',
    name: 'ACC Gold Water-Resistant',
    brand: 'ACC',
    categoryId: 'cement',
    shortDescription: 'Water-resistant cement for foundations & basements.',
    description: 'Ideal for damp zones, water tanks, and basement raft. Improved durability in variable weather.',
    images: [
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd378b?auto=format&fit=crop&w=800&q=80',
    ],
    specs: [
      { label: 'Type', value: 'PPC blended' },
      { label: 'Feature', value: 'Water resistant' },
    ],
    deliveryInfo: '48 hr delivery · GST invoice provided',
    availability: 'in_stock',
    supplier: { name: 'ACC Authorised Depot', rating: 4.5, city: 'Ghaziabad' },
    variantCount: 2,
    priceLabel: '₹365/bag',
    variants: [
      { id: 'v25', label: '25 KG', size: '25', unit: 'bag', retailPrice: 365, contractorPrice: 348, moq: 40 },
      { id: 'bulk50', label: '50 Bag Bulk', size: '50', unit: 'bags', retailPrice: 17200, contractorPrice: 16500, bulkPrice: 15900, moq: 50 },
    ],
    relatedIds: ['ultratech-opc53'],
  },
  {
    id: 'tata-tmt-500d',
    name: 'TATA Tiscon TMT 500D',
    brand: 'TATA Steel',
    categoryId: 'steel',
    shortDescription: 'Fe 500D thermo-mechanically treated bars for seismic zones.',
    description: 'High ductility TMT bars with superior bendability. Suitable for columns, beams, and slabs.',
    images: [
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80',
    ],
    specs: [
      { label: 'Grade', value: 'Fe 500D' },
      { label: 'Diameter', value: '8–32 mm' },
    ],
    deliveryInfo: 'Cut & bend available · Weighbridge slip on delivery',
    availability: 'in_stock',
    supplier: { name: 'SteelHub Contractors', rating: 4.8, city: 'Noida' },
    variantCount: 3,
    priceLabel: '₹62/kg',
    variants: [
      { id: 'd8', label: '8 mm', size: '8', unit: 'kg', retailPrice: 62, contractorPrice: 59, moq: 500 },
      { id: 'd12', label: '12 mm', size: '12', unit: 'kg', retailPrice: 61, contractorPrice: 58, moq: 500 },
      { id: 'd16', label: '16 mm', size: '16', unit: 'kg', retailPrice: 60, contractorPrice: 57, bulkPrice: 55, moq: 1000 },
    ],
    relatedIds: ['ultratech-opc53'],
  },
  {
    id: 'river-sand',
    name: 'River Sand (Fine)',
    brand: 'Local quarry',
    categoryId: 'sand',
    shortDescription: 'Washed fine sand for plaster & masonry.',
    description: 'Low silt river sand suitable for plaster, brickwork, and block joining.',
    images: [
      'https://images.unsplash.com/photo-1618221195710-e326b4f6d3e0?auto=format&fit=crop&w=800&q=80',
    ],
    specs: [
      { label: 'Grade', value: 'Fine' },
      { label: 'Load', value: 'Tractor trolley / truck' },
    ],
    deliveryInfo: 'Loose material · Minimum 1 trolley',
    availability: 'limited',
    supplier: { name: 'Yamuna Aggregates', rating: 4.3, city: 'Faridabad' },
    variantCount: 2,
    priceLabel: '₹2,800/trolley',
    variants: [
      { id: 't1', label: '1 Trolley', size: '1', unit: 'trolley', retailPrice: 2800, contractorPrice: 2650, moq: 1 },
      { id: 'truck', label: 'Truck Load', size: '1', unit: 'truck', retailPrice: 18500, contractorPrice: 17600, bulkPrice: 16900, moq: 1 },
    ],
  },
  {
    id: 'red-bricks',
    name: 'First Class Red Bricks',
    brand: 'Kiln certified',
    categoryId: 'bricks',
    shortDescription: 'Uniform size, high compressive strength bricks.',
    description: 'Kiln-burnt red bricks for load-bearing and partition walls. Low breakage transit packing.',
    images: [
      'https://images.unsplash.com/photo-1621905251189-08b45d6f269e?auto=format&fit=crop&w=800&q=80',
    ],
    specs: [
      { label: 'Size', value: '9×4.5×3 in (nominal)' },
      { label: 'Class', value: 'First' },
    ],
    deliveryInfo: 'Stacked pallet delivery · 5000 pcs per lot',
    availability: 'in_stock',
    supplier: { name: 'BrickLane Suppliers', rating: 4.4, city: 'Greater Noida' },
    variantCount: 2,
    priceLabel: '₹7.2/pc',
    variants: [
      { id: 'pc1000', label: '1000 pcs', size: '1000', unit: 'pcs', retailPrice: 7200, contractorPrice: 6900, moq: 1000 },
      { id: 'pc5000', label: '5000 pcs Bulk', size: '5000', unit: 'pcs', retailPrice: 34000, contractorPrice: 32500, bulkPrice: 31500, moq: 5000 },
    ],
  },
  {
    id: 'asian-paints-apcolite',
    name: 'Asian Paints Apcolite Premium',
    brand: 'Asian Paints',
    categoryId: 'paint',
    shortDescription: 'Washable interior emulsion with rich finish.',
    description: 'Low-VOC premium emulsion for living spaces. Available in base for tinting.',
    images: [
      'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
    ],
    specs: [
      { label: 'Finish', value: 'Matt' },
      { label: 'Coverage', value: '~140 sq ft / L (2 coats)' },
    ],
    deliveryInfo: '48 hrs · Shade card at site visit',
    availability: 'in_stock',
    supplier: { name: 'ColourCraft Depot', rating: 4.6, city: 'Delhi' },
    variantCount: 3,
    priceLabel: '₹520/L',
    variants: [
      { id: 'l1', label: '1 L', size: '1', unit: 'L', retailPrice: 520, contractorPrice: 495, moq: 4 },
      { id: 'l10', label: '10 L', size: '10', unit: 'L', retailPrice: 4900, contractorPrice: 4650, moq: 2 },
      { id: 'l20', label: '20 L Bulk', size: '20', unit: 'L', retailPrice: 9200, contractorPrice: 8800, bulkPrice: 8500, moq: 5 },
    ],
  },
  {
    id: 'cpvc-pipes',
    name: 'Astral CPVC Plumbing Kit',
    brand: 'Astral',
    categoryId: 'pipes',
    shortDescription: 'Hot & cold water CPVC pipes and fittings combo.',
    description: 'Complete plumbing range for bathrooms and kitchens. Contractor-friendly coil packs.',
    images: [
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80',
    ],
    specs: [
      { label: 'Standard', value: 'ASTM D2846' },
      { label: 'Temp', value: 'Up to 93°C' },
    ],
    deliveryInfo: '2–3 days · Fitting guide PDF',
    availability: 'in_stock',
    supplier: { name: 'PlumbMart India', rating: 4.5, city: 'Gurgaon' },
    variantCount: 2,
    priceLabel: 'From ₹1,850',
    variants: [
      { id: 'half', label: '½ inch kit', size: '0.5', unit: 'kit', retailPrice: 1850, contractorPrice: 1720, moq: 1 },
      { id: 'threequarter', label: '¾ inch kit', size: '0.75', unit: 'kit', retailPrice: 2450, contractorPrice: 2280, moq: 1 },
    ],
  },
  {
    id: 'havells-wire',
    name: 'Havells LifeLine HR FR Cable',
    brand: 'Havells',
    categoryId: 'electrical',
    shortDescription: 'Flame retardant copper house wiring cable.',
    description: 'ISI-marked FR PVC insulated cable for residential and commercial wiring.',
    images: [
      'https://images.unsplash.com/photo-1621905251189-08b45d6f269e?auto=format&fit=crop&w=800&q=80',
    ],
    specs: [
      { label: 'Conductor', value: 'Electrolytic copper' },
      { label: 'Insulation', value: 'FR PVC' },
    ],
    deliveryInfo: 'Coil dispatch · 90 m standard coil',
    availability: 'in_stock',
    supplier: { name: 'ElectroBuild Wholesale', rating: 4.7, city: 'Noida' },
    variantCount: 2,
    priceLabel: '₹18/m',
    variants: [
      { id: 'sq15', label: '1.5 sq mm', size: '1.5', unit: 'm', retailPrice: 18, contractorPrice: 16.5, moq: 90 },
      { id: 'sq25', label: '2.5 sq mm', size: '2.5', unit: 'm', retailPrice: 28, contractorPrice: 26, moq: 90 },
    ],
  },
]



module.exports = BUILDMART_PRODUCTS;