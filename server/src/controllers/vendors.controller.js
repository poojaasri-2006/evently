const prisma = require('../utils/prisma');

const getVendors = async (req, res) => {
  try {
    const vendors = await prisma.vendorProfile.findMany({
      include: { 
        category: true,
        services: true,
        packages: {
          include: {
            category: true,
            services: true
          }
        },
        reviews: true
      }
    });
    res.json(vendors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching vendors' });
  }
};

const getVendorCategories = async (req, res) => {
  try {
    const categories = await prisma.vendorCategory.findMany();
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendorProfile.findUnique({
      where: { id },
      include: { 
        category: true,
        services: true,
        packages: {
          include: {
            category: true,
            services: true
          }
        },
        reviews: true
      }
    });

    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json(vendor);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching vendor' });
  }
};

module.exports = { getVendors, getVendorCategories, getVendorById };
