class Template {
  constructor(strings, values) {
    this.values = values;
    this.strings = strings;
  }

  /**
   * Escapes any occurances of &, ", <, > or / with XML entities.
   *
   * @param {string} str
   *        The string to escape.
   * @return {string} The escaped string.
   */
  escapeXML(str) {
    const replacements = {
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
      "<": "&lt;",
      ">": "&gt;",
      "/": "&#x2F;"
    };
    return String(str).replace(/[&"'<>/]/g, m => replacements[m]);
  }

  potentiallyEscape(value) {
    if (typeof value === "object") {
      if (value instanceof Array) {
        return value.map(val => this.potentiallyEscape(val)).join("");
      }

      // If we are an escaped template let join call toString on it
      if (value instanceof Template) {
        return value;
      }

      throw new Error("Unknown object to escape");
    }
    return this.escapeXML(value);
  }

  toString() {
    const result = [];

    for (const [i, string] of this.strings.entries()) {
      result.push(string);
      if (i < this.values.length) {
        result.push(this.potentiallyEscape(this.values[i]));
      }
    }
    return result.join("");
  }

  renderTo(el) {
    // eslint-disable-next-line no-unsanitized/property
    el.innerHTML = this;
  }
}

// eslint-disable-next-line no-unused-vars
function escapedTemplate(strings, ...values) {
  return new Template(strings, values);
}
