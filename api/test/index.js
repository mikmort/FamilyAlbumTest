module.exports = async function (context, req) {
  context.res = {
    status: 200,
    body: `Minimal test: /api/test endpoint is working for ${req.method} request.`
  };
};
