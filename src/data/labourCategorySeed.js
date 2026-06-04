/**
 * Labour Chowk category catalogue — profile tags + trades.
 * Admins can add/edit via API; this seed bootstraps the baseline list.
 * Each item includes imageUrl (Unsplash) for homeowner discovery tiles.
 */
import { LABOUR_CATEGORY_IMAGES as IMG } from './labourCategoryImages.js'

/** @param {string} name @param {string} subtitle @param {number} sortOrder @param {keyof typeof IMG} imageKey */
function cat(name, subtitle, sortOrder, imageKey) {
  return {
    name,
    subtitle,
    sortOrder,
    imageUrl: IMG[imageKey] || '',
  }
}

export const LABOUR_CATEGORY_SEED = [
  {
    group: {
      name: 'Construction workforce (skill band)',
      slug: 'construction-workforce',
      description: 'How you usually work on site — helps match the right crew.',
      helperText: 'Pick what fits you best. You can choose more than one.',
      kind: 'profile',
      sortOrder: 0,
    },
    items: [
      cat('Skilled labor', 'Electricians, plumbers, masons, trained trades', 0, 'skilledLabor'),
      cat('Semi-skilled labor', 'Helpers with some training', 1, 'semiSkilledLabor'),
      cat('Unskilled labor', 'General helpers, loaders', 2, 'unskilledLabor'),
    ],
  },
  {
    group: {
      name: 'Government & legal (India)',
      slug: 'govt-legal-india',
      description: 'Useful for compliance-heavy sites and contractor reporting.',
      helperText: 'Optional — choose if it applies to you.',
      kind: 'profile',
      sortOrder: 1,
    },
    items: [
      cat('Organized sector worker', '', 0, 'organizedSector'),
      cat('Unorganized sector worker', '', 1, 'unorganizedSector'),
      cat('Contract labor', '', 2, 'contractLabor'),
      cat('Migrant worker', '', 3, 'migrantWorker'),
    ],
  },
  {
    group: {
      name: 'HR & corporate roles',
      slug: 'hr-corporate-roles',
      description: 'Broad role type — helps office vs field matching.',
      helperText: 'Optional tags for how you see your role.',
      kind: 'profile',
      sortOrder: 2,
    },
    items: [
      cat('Blue-collar worker', 'Manual / field labor', 0, 'blueCollar'),
      cat('White-collar worker', 'Office / desk roles', 1, 'whiteCollar'),
      cat('Grey-collar worker', 'Technical / hybrid roles', 2, 'greyCollar'),
    ],
  },
  {
    group: {
      name: 'Construction & technical labor',
      slug: 'construction-technical',
      description: 'Core building trades — the jobs most sites hire for.',
      helperText: 'Select every trade you can do professionally.',
      kind: 'trade',
      sortOrder: 10,
    },
    items: [
      cat('Plumber', '', 0, 'plumber'),
      cat('Electrician', '', 1, 'electrician'),
      cat('Carpenter', '', 2, 'carpenter'),
      cat('Mason (Raj Mistri)', '', 3, 'mason'),
      cat('Tile installer', '', 4, 'tileInstaller'),
      cat('Painter', '', 5, 'painter'),
      cat('Welder', '', 6, 'welder'),
      cat('Fabricator', '', 7, 'fabricator'),
      cat('Bar bender (steel fixer)', '', 8, 'barBender'),
      cat('Shuttering carpenter', '', 9, 'shutteringCarpenter'),
      cat('POP worker (Plaster of Paris)', '', 10, 'popWorker'),
      cat('Waterproofing worker', '', 11, 'waterproofing'),
      cat('HVAC technician', '', 12, 'hvacTechnician'),
      cat('Elevator technician', '', 13, 'elevatorTechnician'),
      cat('Solar panel technician', '', 14, 'solarTechnician'),
    ],
  },
  {
    group: {
      name: 'Heavy work & site labor',
      slug: 'heavy-work-site',
      description: 'High-effort site work and road crews.',
      helperText: '',
      kind: 'trade',
      sortOrder: 20,
    },
    items: [
      cat('General labor / helper', '', 0, 'generalHelper'),
      cat('Construction helper', '', 1, 'constructionHelper'),
      cat('Loader / unloader', '', 2, 'loader'),
      cat('Scaffolding worker', '', 3, 'scaffolding'),
      cat('Demolition worker', '', 4, 'demolition'),
      cat('Road construction worker', '', 5, 'roadConstruction'),
      cat('Asphalt worker', '', 6, 'asphalt'),
      cat('Concrete mixer operator', '', 7, 'concreteMixer'),
      cat('Drill machine operator', '', 8, 'drillOperator'),
    ],
  },
  {
    group: {
      name: 'Machine operators',
      slug: 'machine-operators',
      description: 'Heavy equipment on site or yards.',
      helperText: '',
      kind: 'trade',
      sortOrder: 30,
    },
    items: [
      cat('JCB operator', '', 0, 'jcbOperator'),
      cat('Crane operator', '', 1, 'craneOperator'),
      cat('Forklift operator', '', 2, 'forkliftOperator'),
      cat('Excavator operator', '', 3, 'excavatorOperator'),
      cat('Bulldozer operator', '', 4, 'bulldozerOperator'),
      cat('Dumper driver', '', 5, 'dumperDriver'),
      cat('Tractor operator', '', 6, 'tractorOperator'),
    ],
  },
  {
    group: {
      name: 'Home services labor',
      slug: 'home-services',
      description: 'Residential repair and install jobs.',
      helperText: '',
      kind: 'trade',
      sortOrder: 40,
    },
    items: [
      cat('AC technician', '', 0, 'acTechnician'),
      cat('Refrigerator technician', '', 1, 'refrigeratorTechnician'),
      cat('Washing machine technician', '', 2, 'washingMachineTechnician'),
      cat('RO technician', '', 3, 'roTechnician'),
      cat('CCTV installer', '', 4, 'cctvInstaller'),
      cat('Home appliance repair technician', '', 5, 'applianceRepair'),
      cat('Pest control worker', '', 6, 'pestControl'),
    ],
  },
  {
    group: {
      name: 'Automobile & mechanical',
      slug: 'automobile-mechanical',
      description: 'Workshops and vehicle care.',
      helperText: '',
      kind: 'trade',
      sortOrder: 50,
    },
    items: [
      cat('Mechanic (2-wheeler)', '', 0, 'mechanic2w'),
      cat('Mechanic (4-wheeler)', '', 1, 'mechanic4w'),
      cat('Diesel mechanic', '', 2, 'dieselMechanic'),
      cat('Auto electrician', '', 3, 'autoElectrician'),
      cat('Tyre repair worker', '', 4, 'tyreRepair'),
      cat('Car washer', '', 5, 'carWasher'),
    ],
  },
  {
    group: {
      name: 'Cleaning & maintenance',
      slug: 'cleaning-maintenance',
      description: 'Hygiene and upkeep roles.',
      helperText: '',
      kind: 'trade',
      sortOrder: 60,
    },
    items: [
      cat('Housekeeping staff', '', 0, 'housekeeping'),
      cat('Office cleaner', '', 1, 'officeCleaner'),
      cat('Industrial cleaner', '', 2, 'industrialCleaner'),
      cat('Garbage collector', '', 3, 'garbageCollector'),
      cat('Drain cleaner', '', 4, 'drainCleaner'),
      cat('Sweeper', '', 5, 'sweeper'),
    ],
  },
  {
    group: {
      name: 'Hospitality & support',
      slug: 'hospitality-support',
      description: 'Food service and last-mile support.',
      helperText: '',
      kind: 'trade',
      sortOrder: 70,
    },
    items: [
      cat('Cook / chef', '', 0, 'cook'),
      cat('Helper cook', '', 1, 'helperCook'),
      cat('Waiter', '', 2, 'waiter'),
      cat('Dishwasher', '', 3, 'dishwasher'),
      cat('Delivery boy', '', 4, 'deliveryBoy'),
    ],
  },
  {
    group: {
      name: 'Specialized & finishing work',
      slug: 'specialized-finishing',
      description: 'Fit-out and detail trades.',
      helperText: '',
      kind: 'trade',
      sortOrder: 80,
    },
    items: [
      cat('Interior designer helper', '', 0, 'interiorHelper'),
      cat('Glass installer', '', 1, 'glassInstaller'),
      cat('Aluminium worker', '', 2, 'aluminiumWorker'),
      cat('False ceiling worker', '', 3, 'falseCeiling'),
      cat('Modular kitchen installer', '', 4, 'modularKitchen'),
    ],
  },
  {
    group: {
      name: 'Outdoor & miscellaneous',
      slug: 'outdoor-miscellaneous',
      description: 'Gardens, security, transport, and moves.',
      helperText: '',
      kind: 'trade',
      sortOrder: 90,
    },
    items: [
      cat('Gardener / mali', '', 0, 'gardener'),
      cat('Security guard', '', 1, 'securityGuard'),
      cat('Driver (light vehicle)', '', 2, 'driverLight'),
      cat('Driver (heavy vehicle)', '', 3, 'driverHeavy'),
      cat('Mover & packer worker', '', 4, 'moverPacker'),
    ],
  },
]
