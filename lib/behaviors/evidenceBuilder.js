// lib/behaviors/evidenceBuilder.js

/**
 * Behavior Evidence Builder V2
 * Categories evidence into Observed, Declared, and Derived to provide clear AI Coaching context.
 */

export function buildEvidence() {
  return {
    observed: [],
    declared: [],
    context: [],
    
    addObserved(text) {
      this.observed.push(text);
    },
    
    addDeclared(text) {
      this.declared.push(text);
    },
    
    addContext(text) {
      this.context.push(text);
    },
    
    toArray() {
      // Compatibility with V1 structure if needed
      return [...this.observed, ...this.declared, ...this.context];
    },
    
    toObject() {
      return {
        observed: this.observed,
        declared: this.declared,
        context: this.context
      };
    }
  };
}
