/**
 * Version Endpoint
 * Returns version information and build timestamp for diagnostics
 */
module.exports = async function (context, req) {
  const devModeRequested = (process.env.DEV_MODE || '').toLowerCase() === 'true';
  const isProductionHost =
    (process.env.NODE_ENV || '').toLowerCase() === 'production' ||
    (process.env.AZURE_FUNCTIONS_ENVIRONMENT || '').toLowerCase() === 'production' ||
    Boolean(process.env.WEBSITE_SITE_NAME);

  const version = {
    version: "1.0.1",
    buildDate: "2025-11-12T17:00:00Z", // Updated on each deployment
    commit: process.env.GITHUB_SHA || "local-dev",
    environment: process.env.AZURE_FUNCTIONS_ENVIRONMENT || "local",
    nodeVersion: process.version,
    authDiagnostics: {
      devModeRequested,
      productionHostDetected: isProductionHost,
      devModeEffective: devModeRequested && !isProductionHost
    },
    features: {
      databaseWarmupHandling: true,
      faceTrainingOptimization: true,
      maxPhotosLimit: 5000,
      sasUrlBatchSize: 50,
      midsizeImageSupport: true
    }
  };

  context.res = {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    },
    body: version
  };
};
