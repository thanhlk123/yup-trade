// lib/behaviors/evidenceBuilder.js

/**
 * Behavior Evidence Builder V2
 * Categories evidence into Observed, Declared, and Derived to provide clear AI Coaching context.
 */

export function buildEvidence() {
  return {
    observed: [],
    declared: [],
    derived: [],
    
    addObserved(text) {
      this.observed.push(text);
    },
    
    addDeclared(text) {
      this.declared.push(text);
    },
    
    addDerived(text) {
      this.derived.push(text);
    },
    
    toArray() {
      // Compatibility with V1 structure if needed
      return [...this.observed, ...this.declared, ...this.derived];
    },
    
    toObject() {
      return {
        observed: this.observed,
        declared: this.declared,
        derived: this.derived
      };
    }
  };
}
