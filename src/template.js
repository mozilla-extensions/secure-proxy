class Template {
  constructor(strings, values) {
    this.escaped = true;
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

  toString() {
    const result = [];

    for (const [i, string] of this.strings.entries()) {
      result.push(string);
      if (i < this.values.length) {
        if (typeof this.values[i] === "object" && this.escaped) {
          if (this.values[i] instanceof Array) {
            let myarray = this.values[i];
            myarray.forEach(val => result.push(val));
          } else {
            result.push(this.values[i]);
          }
        } else {
          result.push(this.escapeXML(this.values[i]));
        }
      }
    }
    return result.join("");
  }
}

export function escapedTemplate(strings, ...values) {
  return new Template(strings, values);
}
