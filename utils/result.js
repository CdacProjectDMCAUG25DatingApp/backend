function createResult(err, data = null) {
  if (err) {
    return {
      status: "error",
      error: err
    };
  }

  return {
    status: "success",
    data: data
  };
}

module.exports = { createResult };
