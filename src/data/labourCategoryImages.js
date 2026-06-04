/**
 * Curated Unsplash images for labour category tiles (home / search UI).
 * Format: w=600, crop, q=80 — stable HTTPS URLs for MongoDB seed upserts.
 */
const u = (id) =>
  `https://images.unsplash.com/photo-${id}?w=600&h=450&fit=crop&q=80&auto=format`

export const LABOUR_CATEGORY_IMAGES = {
  // Profile — construction workforce
  skilledLabor: u('1504307651254-35680f356dfd'),
  semiSkilledLabor: u('1581094794329-c8112a89af12'),
  unskilledLabor: u('1595846519845-68bb3376c517'),

  // Profile — government & legal
  organizedSector: u('1586528111869-77e4a7d0d5c5'),
  unorganizedSector: u('1541888946425-d81bb19240f5'),
  contractLabor: u('1454165804606-c3d57bc86b40'),
  migrantWorker: u('1521791136064-7986c2920216'),

  // Profile — HR & corporate
  blueCollar: u('1504917595217-0f660d5950e7'),
  whiteCollar: u('1497366216548-37526070297c'),
  greyCollar: u('1621905251189-08b45d6a269e'),

  // Trades — construction & technical
  plumber: u('1558618666-fcd25c85f268'),
  electrician: u('1621905251189-08b45d6a269e'),
  carpenter: u('1503387762-592deb58ef4e'),
  mason: u('1541888946425-d81bb19240f5'),
  tileInstaller: u('1581578731548-7f23fd20fb2a'),
  painter: u('1562259949-e8e7689d3270'),
  welder: u('1504917595217-0f660d5950e7'),
  fabricator: u('1504917595217-0f660d5950e7'),
  barBender: u('1504307651254-35680f356dfd'),
  shutteringCarpenter: u('1541974231534-cbb7c38d5c53'),
  popWorker: u('1600585154340-be6161a56a0c'),
  waterproofing: u('1541888946425-d81bb19240f5'),
  hvacTechnician: u('1581094794329-c8112a89af12'),
  elevatorTechnician: u('1486406146926-c627a92fd1b3'),
  solarTechnician: u('1509391366360-2e959784a276'),

  // Heavy work & site
  generalHelper: u('1595846519845-68bb3376c517'),
  constructionHelper: u('1504307651254-35680f356dfd'),
  loader: u('1586528111869-77e4a7d0d5c5'),
  scaffolding: u('1541974231534-cbb7c38d5c53'),
  demolition: u('1503387762-592deb58ef4e'),
  roadConstruction: u('1513828583688-c52646d9d3ba'),
  asphalt: u('1558618666-fcd25c85f268'),
  concreteMixer: u('1581094794329-c8112a89af12'),
  drillOperator: u('1621905252507-b35492cc74b4'),

  // Machine operators
  jcbOperator: u('1581091225360-592a4b0a6a0c'),
  craneOperator: u('1541888946425-d81bb19240f5'),
  forkliftOperator: u('1586528111869-77e4a7d0d5c5'),
  excavatorOperator: u('1581094794329-c8112a89af12'),
  bulldozerOperator: u('1513828583688-c52646d9d3ba'),
  dumperDriver: u('1601581875070-1f899aa1cb2f'),
  tractorOperator: u('1625246333198-78c963c3609e'),

  // Home services
  acTechnician: u('1581094794329-c8112a89af12'),
  refrigeratorTechnician: u('1581578731548-7f23fd20fb2a'),
  washingMachineTechnician: u('1558618666-fcd25c85f268'),
  roTechnician: u('1625246333198-78c963c3609e'),
  cctvInstaller: u('1621905251189-08b45d6a269e'),
  applianceRepair: u('1581094794329-c8112a89af12'),
  pestControl: u('1595846519845-68bb3376c517'),

  // Automobile
  mechanic2w: u('1486262715619-67b85e0b08d3'),
  mechanic4w: u('1486262715619-67b85e0b08d3'),
  dieselMechanic: u('1486262715619-67b85e0b08d3'),
  autoElectrician: u('1621905251189-08b45d6a269e'),
  tyreRepair: u('1486262715619-67b85e0b08d3'),
  carWasher: u('1486262715619-67b85e0b08d3'),

  // Cleaning & maintenance
  housekeeping: u('1581578731548-7f23fd20fb2a'),
  officeCleaner: u('1497366216548-37526070297c'),
  industrialCleaner: u('1581094794329-c8112a89af12'),
  garbageCollector: u('1595846519845-68bb3376c517'),
  drainCleaner: u('1558618666-fcd25c85f268'),
  sweeper: u('1595846519845-68bb3376c517'),

  // Hospitality
  cook: u('1556910103-1c02745aae4d'),
  helperCook: u('1556910103-1c02745aae4d'),
  waiter: u('1414235077428-338989a2e8c0'),
  dishwasher: u('1556910103-1c02745aae4d'),
  deliveryBoy: u('1601581875070-1f899aa1cb2f'),

  // Specialized finishing
  interiorHelper: u('1618221195710-e72f35f65e7f'),
  glassInstaller: u('1600585154340-be6161a56a0c'),
  aluminiumWorker: u('1504917595217-0f660d5950e7'),
  falseCeiling: u('1600607687939-ce8a6c25118c'),
  modularKitchen: u('1618221195710-e72f35f65e7f'),

  // Outdoor & misc
  gardener: u('1416879595882-3373a0480b5b'),
  securityGuard: u('1557804506-669a77945c8c'),
  driverLight: u('1449965408869-eaa3f725e40e'),
  driverHeavy: u('1601581875070-1f899aa1cb2f'),
  moverPacker: u('1601581875070-1f899aa1cb2f'),
}
