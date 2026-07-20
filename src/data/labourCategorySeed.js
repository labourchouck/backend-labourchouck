import { LABOUR_CATEGORY_IMAGES as IMG } from './labourCategoryImages.js'

export const LABOUR_CATEGORY_SEED_V2 = [
  {
    category: "Construction",
    subtitle: "Building, masonry, and finishing experts",
    subcategories: [
      {
        name: "Civil & Structural Work",
        description: "Experts in structural construction, masonry, carpentry, and reinforcement work.",
        image: IMG.mason,
        services: [
          { name: "Mason (Raj Mistri)", basePrice: 800, description: "Professional masonry, bricklaying, and plastering work." },
          { name: "Carpenter", basePrice: 700, description: "Expert woodwork, furniture assembly, and repair." },
          { name: "Shuttering Carpenter", basePrice: 750, description: "Formwork and shuttering for concrete pouring." },
          { name: "Bar Bender (Steel Fixer)", basePrice: 700, description: "Steel reinforcement cutting, bending, and fixing." },
          { name: "Tile Installer", basePrice: 800, description: "Floor and wall tiling with precision and finishing." },
          { name: "POP Worker", basePrice: 600, description: "Plaster of Paris work, false ceilings, and cornices." },
          { name: "Waterproofing Worker", basePrice: 750, description: "Surface treatments to prevent water leakage and damage." }
        ]
      },
      {
        name: "Plumbing & Electrical",
        description: "Professionals for plumbing, electrical, HVAC, and utility installations.",
        image: IMG.electrician,
        services: [
          { name: "Plumber", basePrice: 600, description: "Pipe installation, leak repair, and bathroom fittings." },
          { name: "Electrician", basePrice: 650, description: "Wiring, switchboard installation, and fault repair." },
          { name: "HVAC Technician", basePrice: 800, description: "Heating, ventilation, and AC ducting installation." },
          { name: "Elevator Technician", basePrice: 1200, description: "Lift installation, maintenance, and troubleshooting." },
          { name: "Solar Panel Technician", basePrice: 900, description: "Solar panel mounting and electrical integration." }
        ]
      },
      {
        name: "Metal & Fabrication",
        description: "Skilled workers for welding, fabrication, and metal structure work.",
        image: IMG.welder,
        services: [
          { name: "Welder", basePrice: 700, description: "Arc, MIG, and TIG welding for metal structures." },
          { name: "Fabricator", basePrice: 800, description: "Metal cutting, shaping, and assembly work." }
        ]
      },
      {
        name: "Finishing Work",
        description: "Specialists in painting and surface finishing.",
        image: IMG.painter,
        services: [
          { name: "Painter", basePrice: 500, description: "Interior and exterior wall painting and texturing." }
        ]
      }
    ]
  },
  {
    category: "Site Labour",
    subtitle: "Reliable helpers and site operations support",
    subcategories: [
      {
        name: "General Labour",
        description: "Reliable helpers for daily construction and manual tasks.",
        image: IMG.generalHelper,
        services: [
          { name: "General Labor / Helper", basePrice: 400, description: "Assistance with general site tasks and manual work." },
          { name: "Construction Helper", basePrice: 450, description: "Support for masons and specialized construction workers." },
          { name: "Loader / Unloader", basePrice: 500, description: "Loading and unloading of construction materials." }
        ]
      },
      {
        name: "Site Operations",
        description: "Workers supporting construction site operations and groundwork.",
        image: IMG.scaffolding,
        services: [
          { name: "Scaffolding Worker", basePrice: 600, description: "Erecting and dismantling scaffolding structures safely." },
          { name: "Demolition Worker", basePrice: 550, description: "Safe breaking and removal of old structures." },
          { name: "Road Construction Worker", basePrice: 500, description: "Asphalt laying and road surface preparation." },
          { name: "Asphalt Worker", basePrice: 550, description: "Specialized in applying and leveling asphalt." }
        ]
      },
      {
        name: "Equipment Support",
        description: "Operators assisting with construction tools and machinery.",
        image: IMG.concreteMixer,
        services: [
          { name: "Concrete Mixer Operator", basePrice: 600, description: "Operating and maintaining concrete mixing machines." },
          { name: "Drill Machine Operator", basePrice: 600, description: "Heavy-duty drilling and surface breaking." }
        ]
      }
    ]
  },
  {
    category: "Machine Operators",
    subtitle: "Certified operators for heavy equipment",
    subcategories: [
      {
        name: "Earth Moving Equipment",
        description: "Operators for excavation and earthmoving machinery.",
        image: IMG.excavatorOperator,
        services: [
          { name: "JCB Operator", basePrice: 1000, description: "Experienced operator for JCB backhoe loaders." },
          { name: "Excavator Operator", basePrice: 1200, description: "Operating heavy excavators for digging and trenching." },
          { name: "Bulldozer Operator", basePrice: 1200, description: "Operating bulldozers for site clearing and grading." }
        ]
      },
      {
        name: "Lifting Equipment",
        description: "Certified operators for cranes and material lifting equipment.",
        image: IMG.craneOperator,
        services: [
          { name: "Crane Operator", basePrice: 1500, description: "Operating mobile and tower cranes for heavy lifting." },
          { name: "Forklift Operator", basePrice: 800, description: "Operating forklifts for material handling." }
        ]
      },
      {
        name: "Transport Equipment",
        description: "Operators for construction transport and heavy vehicles.",
        image: IMG.dumperDriver,
        services: [
          { name: "Dumper Driver", basePrice: 900, description: "Driving dumper trucks for transporting loose materials." },
          { name: "Tractor Operator", basePrice: 700, description: "Operating tractors for agricultural or site haulage." }
        ]
      }
    ]
  },
  {
    category: "Home Services",
    subtitle: "Appliance repair, cooling, and security",
    subcategories: [
      {
        name: "HVAC & Cooling",
        description: "Installation and repair of air conditioning and cooling systems.",
        image: IMG.acTechnician,
        services: [
          { name: "AC Technician", basePrice: 500, description: "Air conditioner servicing, repair, and gas refilling." },
          { name: "Refrigerator Technician", basePrice: 450, description: "Fridge repair and compressor troubleshooting." }
        ]
      },
      {
        name: "Home Appliances",
        description: "Repair and maintenance of household appliances.",
        image: IMG.washingMachineTechnician,
        services: [
          { name: "Washing Machine Technician", basePrice: 400, description: "Repair and servicing for washing machines." },
          { name: "RO Technician", basePrice: 350, description: "Water purifier filter replacement and repair." },
          { name: "Home Appliance Repair Technician", basePrice: 400, description: "General repair for microwaves, geysers, and other appliances." }
        ]
      },
      {
        name: "Security & Automation",
        description: "Installation of CCTV and home security systems.",
        image: IMG.cctvInstaller,
        services: [
          { name: "CCTV Installer", basePrice: 600, description: "Security camera installation and DVR setup." }
        ]
      },
      {
        name: "Pest Control",
        description: "Safe and effective pest management services.",
        image: IMG.pestControl,
        services: [
          { name: "Pest Control Worker", basePrice: 700, description: "Treatment for termites, cockroaches, and rodents." }
        ]
      }
    ]
  },
  {
    category: "Automobile Services",
    subtitle: "Vehicle repair and maintenance professionals",
    subcategories: [
      {
        name: "Vehicle Repair",
        description: "Professional repair services for two-wheelers and four-wheelers.",
        image: IMG.mechanic4w,
        services: [
          { name: "Mechanic (2-Wheeler)", basePrice: 300, description: "Bike and scooter servicing and engine repair." },
          { name: "Mechanic (4-Wheeler)", basePrice: 500, description: "Car servicing, diagnostics, and mechanical repairs." },
          { name: "Diesel Mechanic", basePrice: 600, description: "Specialized repair for diesel engines and heavy vehicles." },
          { name: "Auto Electrician", basePrice: 450, description: "Vehicle wiring, battery, and electrical troubleshooting." }
        ]
      },
      {
        name: "Vehicle Maintenance",
        description: "Tyre repair, cleaning, and routine vehicle maintenance.",
        image: IMG.carWasher,
        services: [
          { name: "Tyre Repair Worker", basePrice: 150, description: "Puncture repair, wheel balancing, and tyre changes." },
          { name: "Car Washer", basePrice: 250, description: "Exterior washing and interior detailing for cars." }
        ]
      }
    ]
  },
  {
    category: "Cleaning Services",
    subtitle: "Residential, commercial, and public cleaning",
    subcategories: [
      {
        name: "Residential Cleaning",
        description: "Cleaning services for homes and residential spaces.",
        image: IMG.housekeeping,
        services: [
          { name: "Housekeeping Staff", basePrice: 300, description: "Daily sweeping, mopping, and home tidying." }
        ]
      },
      {
        name: "Commercial Cleaning",
        description: "Cleaning solutions for offices, shops, and industries.",
        image: IMG.officeCleaner,
        services: [
          { name: "Office Cleaner", basePrice: 350, description: "Maintenance and cleaning of office premises." },
          { name: "Industrial Cleaner", basePrice: 500, description: "Deep cleaning for factories and industrial spaces." }
        ]
      },
      {
        name: "Public Cleaning",
        description: "Public sanitation, waste collection, and area maintenance.",
        image: IMG.garbageCollector,
        services: [
          { name: "Garbage Collector", basePrice: 200, description: "Waste collection and disposal services." },
          { name: "Drain Cleaner", basePrice: 400, description: "Unclogging and cleaning of drainage systems." },
          { name: "Sweeper", basePrice: 250, description: "Street and public area sweeping." }
        ]
      }
    ]
  },
  {
    category: "Hospitality",
    subtitle: "Food services, restaurant staff, and delivery",
    subcategories: [
      {
        name: "Food Services",
        description: "Skilled professionals for cooking and kitchen assistance.",
        image: IMG.cook,
        services: [
          { name: "Cook / Chef", basePrice: 600, description: "Preparation of meals for homes or events." },
          { name: "Helper Cook", basePrice: 400, description: "Assisting chefs with chopping and prep work." }
        ]
      },
      {
        name: "Restaurant Staff",
        description: "Staff for serving customers and restaurant operations.",
        image: IMG.waiter,
        services: [
          { name: "Waiter", basePrice: 350, description: "Serving food and beverages to guests." },
          { name: "Dishwasher", basePrice: 300, description: "Washing dishes and maintaining kitchen hygiene." }
        ]
      },
      {
        name: "Delivery",
        description: "Fast and reliable delivery service professionals.",
        image: IMG.deliveryBoy,
        services: [
          { name: "Delivery Boy", basePrice: 400, description: "Door-to-door delivery of goods and food." }
        ]
      }
    ]
  },
  {
    category: "Interior & Finishing",
    subtitle: "Interior installation and finishing works",
    subcategories: [
      {
        name: "Interior Installation",
        description: "Experts in interior fixtures, ceilings, glass, and modular installations.",
        image: IMG.modularKitchen,
        services: [
          { name: "Interior Designer Helper", basePrice: 500, description: "Assisting with interior design executions." },
          { name: "Glass Installer", basePrice: 600, description: "Cutting and fitting glass panels and windows." },
          { name: "Aluminium Worker", basePrice: 650, description: "Fabricating and installing aluminium frames and partitions." },
          { name: "False Ceiling Worker", basePrice: 700, description: "Installation of gypsum and POP false ceilings." },
          { name: "Modular Kitchen Installer", basePrice: 800, description: "Assembly and fitting of modular kitchen cabinets." }
        ]
      }
    ]
  },
  {
    category: "Outdoor Services",
    subtitle: "Gardening, security, and transportation",
    subcategories: [
      {
        name: "Gardening",
        description: "Garden maintenance and landscaping services.",
        image: IMG.gardener,
        services: [
          { name: "Gardener / Mali", basePrice: 350, description: "Plant care, pruning, and lawn maintenance." }
        ]
      },
      {
        name: "Security",
        description: "Professional security and guarding services.",
        image: IMG.securityGuard,
        services: [
          { name: "Security Guard", basePrice: 400, description: "Premises guarding and visitor logging." }
        ]
      },
      {
        name: "Transportation",
        description: "Experienced drivers for personal and commercial transport.",
        image: IMG.driverHeavy,
        services: [
          { name: "Driver (Light Vehicle)", basePrice: 500, description: "Driving cars and light commercial vehicles." },
          { name: "Driver (Heavy Vehicle)", basePrice: 800, description: "Operating trucks and heavy transport vehicles." }
        ]
      },
      {
        name: "Packing & Moving",
        description: "Safe packing, loading, and relocation assistance.",
        image: IMG.moverPacker,
        services: [
          { name: "Mover & Packer Worker", basePrice: 500, description: "Careful packing and loading of household items." }
        ]
      }
    ]
  }
];
