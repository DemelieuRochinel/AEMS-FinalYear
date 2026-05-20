const db = require('../config/firebase');

const businessesRef = db.ref('businesses');


const createBusiness = async (businessId, data) => {
/*
 Office / Administration
 Shop / Retail
 Restaurant / Food service
 School / Training center
 Healthcare / Pharmacy
 Small factory / Workshop
*/
if(!data.name || !data.owner_email){
  throw new error("You must fill all the information correct");
}

    try {
        const businessData = {
            name: data.name || '',
            owner_name: data.owner_name || '',
            owner_phone: data.owner_phone || '',
            owner_email: data.owner_email || '',
            location: data.location || '',
            business_type: data.business_type ||'office',// shope, 
            subscription_plan: data.subscription_plan || 'basic', 
            subscription_active: true, //true, flase if not active 
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),

            settings: {
                daily_kwh_limit: data.settings?.daily_kwh_limit || 50,
                monthly_kwh_budget: data.settings?.monthly_kwh_budget || 400,
                voltage_min: data.settings?.voltage_min || 190,
                voltage_max: data.settings?.voltage_max || 245,
                auto_shutdown_delay: data.settings?.auto_shutdown_delay || 15,
                closing_time: data.settings?.closing_time || '18:30',
                currency: 'FCFA',
                language: data.settings?.language || 'eng',
                eneo_traff_tier: data.settings?.eneo_traff_tier || 'medium',
            },

        };
        await businessesRef.child(businessId).set(businessData);
        return {success: true, businessId, data: businessData};

    } catch (error){

        console.error('createBusiness error: ', error.message);
        throw new Error(`Failed to create bussiness: ${error.message}`);
    }
};

const getBusinessById = async (businessId) => {
  try {
    const snapshot = await businessesRef.child(businessId).once('value');

    if (!snapshot.exists()) {
      return null;
    }

    return { id: businessId, ...snapshot.val() };

  } catch (error) {
    console.error('getBusinessById error:', error.message);
    throw new Error(`Failed to get business: ${error.message}`);
  }
};

const getAllBusinesses = async () => {
  try {
    const snapshot = await businessesRef.once('value');

    if (!snapshot.exists()) {
        return [];
}
    // Convert Firebase object to array
    const businesses = [];
    snapshot.forEach((child) => {
      businesses.push({ id: child.key, ...child.val() });
    });

    return businesses;

  } catch (error) {
    console.error('getAllBusinesses error:', error.message);
    // throw new Error(`Failed to get businesses: ${error.message}`);
    return [];
  }
};

const updateBusiness = async (businessId, updates) => {
  try {
    // First check business exists
    const snapshot = await businessesRef.child(businessId).once('value');
    if (!snapshot.exists()) {
      throw new Error(`Business ${businessId} does not exist`);
    }

    // Add updated_at timestamp
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await businessesRef.child(businessId).update(updateData);

    return { success: true, businessId, updated: updateData };

  } catch (error) {
    console.error('updateBusiness error:', error.message);
    throw new Error(`Failed to update business: ${error.message}`);
  }
};

const updateBusinessSettings = async (businessId, settings) => {
  try {
    await businessesRef
      .child(businessId)
      .child('settings')
      .update(settings);

    return { success: true, businessId, settings };

  } catch (error) {
    console.error('updateBusinessSettings error:', error.message);
    throw new Error(`Failed to update settings: ${error.message}`);
  }
};

const deleteBusiness = async (businessId) => {
  try {
    await businessesRef.child(businessId).remove();
    return { success: true, businessId };

  } catch (error) {
    console.error('deleteBusiness error:', error.message);
    throw new Error(`Failed to delete business: ${error.message}`);
  }
};

const getBusinessSettings = async (businessId) => {
  try {
    const snapshot = await businessesRef
      .child(businessId)
      .child('settings')
      .once('value');

    if (!snapshot.exists()) {
      throw new Error(`No settings found for business ${businessId}`);
    }

    return snapshot.val();

  } catch (error) {
    console.error('getBusinessSettings error:', error.message);
    throw new Error(`Failed to get settings: ${error.message}`);
  }
};

module.exports = {
  createBusiness,
  getBusinessById,
  getAllBusinesses,
  updateBusiness,
  updateBusinessSettings,
  deleteBusiness,
  getBusinessSettings,
};