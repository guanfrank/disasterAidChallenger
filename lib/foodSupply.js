'use strict';
/**
 * Write your transction processor functions here
 */

/*
  */

/**
 * Create new product listing contrat for the list of prodcuts
 * @param {composer.aid.supply.createProductListing} createProductListing
 * @transaction
 */
function createProductListing(listing) {
  if (listing.products == null || listing.products.length == 0) {
    throw new Error('Product list Empty!!');
  }
  var factory = getFactory();
  var productListing = factory.newResource('composer.aid.supply', 'ProductListingContract', Math.random().toString(36).substring(3));
  productListing.status = 'INITIALREQUEST';
  productListing.supplier = listing.user;
  productListing.owner = listing.user;
  productListing.products = [];
  listing.products.forEach(function (item) {
    var prodInfo = item.split(',');
    var product = factory.newConcept('composer.aid.supply', 'Product');
    product.productId = prodInfo[0];
    product.countryId = listing.user.countryId;
    if (prodInfo.length > 1) {
      product.quantity = prodInfo[1];
    } else {
      product.quantity = '1';
    }
    productListing.products.push(product);
  });
  return getAssetRegistry('composer.aid.supply.ProductListingContract')
    .then(function (listingRegistry) {
      return listingRegistry.add(productListing);
    });
}

/**
 * Transfer the product listing to new owner
 * @param {composer.aid.supply.transferListing} transferListing
 * @transaction
 */
function transferListing(listing) {
  var productListing = listing.productListing;
  productListing.owner = listing.newOwner;
  if (listing.ownerType.toLowerCase() == 'supplier') {
    listing.ownerType = 'Importer'
    if (productListing.status != 'CHECKCOMPLETED') {
      productListing.status = 'EXEMPTCHECKREQ';
    }
  } else if (listing.ownerType.toLowerCase() == 'importer') {
    listing.ownerType = 'Retailer';
    if (productListing.status != 'CHECKCOMPLETED') {
      throw new Error('Exempt check pending!!');
    }
  } else {
    throw new Error('Please provide valid value for owner type');
  }
  var newOwnerReg = null;
  return getParticipantRegistry('composer.aid.supply.' + listing.ownerType)
    .then(function (registry) {
      newOwnerReg = registry;
      return registry.exists(listing.newOwner.getIdentifier());
    })
    .then(function (check) {
      if (check) {
        return getAssetRegistry('composer.aid.supply.ProductListingContract')
      }
      else {
        throw new Error('Please provide correct details for new owner');
      }
    })
    .then(function (listingRegistry) {
      return listingRegistry.update(productListing);
    })
    .then(function () {
      if (listing.ownerType == 'Retailer') {
        productListing.products.forEach(function (item) {
          listing.newOwner.products.push(item);
        });
        return newOwnerReg.update(listing.newOwner);
      } else {
        return true;
      }
    });
}



/**
 * Exempt check for the list of products by the regulator
 * @param {composer.aid.supply.checkProducts} checkProducts
 * @transaction
 */
function checkProducts(listing) {
  var productListing = listing.productListing;
  if (productListing.status != 'EXEMPTCHECKREQ' && productListing.status != 'HAZARDANALYSISCHECKREQ') {
    throw new Error('UnAuthorized transaction!!');
  }
  var check = true;

  if (listing.regulator.exemptedOrgIds.indexOf(productListing.supplier.orgId) == -1) {
    for (index in productListing.products) {
      var product = productListing.products[index];
      console.log('exempted product ids: ' + listing.regulator.exemptedProductIds.toString());
      if (listing.regulator.exemptedProductIds.indexOf(product.productId) == -1) {
        check = false;
        break;
      }
    }
  }

  if (check) {
    productListing.status = 'CHECKCOMPLETED';
  }
  else {
    productListing.status = 'HAZARDANALYSISCHECKREQ';
  }
  return getAssetRegistry('composer.aid.supply.ProductListingContract')
    .then(function (listingRegistry) {
      return listingRegistry.update(productListing);
    });

}

/**
 * Update exempted list
 * @param {composer.aid.supply.updateExemptedList} updateExemptedList
 * @transaction
 */
function updateExemptedList(list) {
  if (list.newExemptedOrgIds != null && list.newExemptedOrgIds.length > 0) {
    list.newExemptedOrgIds.forEach(function (item) {
      list.regulator.exemptedOrgIds.push(item);
    });
  }
  if (list.newExemptedProductIds != null && list.newExemptedProductIds.length > 0) {
    list.newExemptedProductIds.forEach(function (item) {
      list.regulator.exemptedProductIds.push(item);
    });
  }
  return getParticipantRegistry('composer.aid.supply.Regulator')
    .then(function (registry) {
      return registry.update(list.regulator);
    });
}
