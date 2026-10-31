/** Convert FormData to a plain payload, preserving unchecked checkbox values as false. */
function formPayload(formData, fields = []) {
  const body = Object.fromEntries(formData.entries());
  for (const field of fields) {
    if (field.type === "checkbox") body[field.name] = formData.has(field.name);
  }
  return body;
}

module.exports = { formPayload };
