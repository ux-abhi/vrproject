import { CONFIG } from '../config.js';

export class StateManager {
  constructor() {
    this.currentState = CONFIG.STATES.INTRO;
    this.listeners = [];
    this.stateTimestamps = {};
    this.startTime = null;
    this.callStartTime = null;
    this.callEndTime = null;
    this.failCount = 0;
    this.questionIndex = 0;

    // Valid state transitions
    this.transitions = {
      [CONFIG.STATES.INTRO]: [CONFIG.STATES.VEST_PICKUP],
      [CONFIG.STATES.VEST_PICKUP]: [CONFIG.STATES.TRIANGLE_PICKUP, CONFIG.STATES.FAIL],
      [CONFIG.STATES.TRIANGLE_PICKUP]: [CONFIG.STATES.TRIANGLE_HELD, CONFIG.STATES.FAIL],
      [CONFIG.STATES.TRIANGLE_HELD]: [CONFIG.STATES.TRIANGLE_PLACED, CONFIG.STATES.FAIL],
      [CONFIG.STATES.TRIANGLE_PLACED]: [CONFIG.STATES.CALLING_112],
      [CONFIG.STATES.CALLING_112]: [CONFIG.STATES.CALL_COMPLETE],
      [CONFIG.STATES.CALL_COMPLETE]: [CONFIG.STATES.APPROACH_VICTIM],
      [CONFIG.STATES.APPROACH_VICTIM]: [CONFIG.STATES.COMPLETE],
      [CONFIG.STATES.FAIL]: [CONFIG.STATES.VEST_PICKUP, CONFIG.STATES.TRIANGLE_PICKUP, CONFIG.STATES.TRIANGLE_HELD],
    };
  }

  on(callback) {
    this.listeners.push(callback);
  }

  emit(oldState, newState) {
    for (const cb of this.listeners) {
      cb(oldState, newState);
    }
  }

  transition(newState) {
    const allowed = this.transitions[this.currentState];
    if (!allowed || !allowed.includes(newState)) {
      console.warn(`Invalid transition: ${this.currentState} -> ${newState}`);
      return false;
    }

    const oldState = this.currentState;
    this.currentState = newState;
    this.stateTimestamps[newState] = performance.now();

    if (newState === CONFIG.STATES.VEST_PICKUP && !this.startTime) {
      this.startTime = performance.now();
    }

    if (newState === CONFIG.STATES.CALLING_112) {
      this.callStartTime = performance.now();
    }

    if (newState === CONFIG.STATES.CALL_COMPLETE) {
      this.callEndTime = performance.now();
    }

    if (newState === CONFIG.STATES.FAIL) {
      this.failCount++;
      this.stateBeforeFail = oldState;
    }

    this.emit(oldState, newState);
    return true;
  }

  isState(...states) {
    return states.includes(this.currentState);
  }

  isTrianglePlacedOrLater() {
    const ordered = [
      CONFIG.STATES.TRIANGLE_PLACED,
      CONFIG.STATES.CALLING_112,
      CONFIG.STATES.CALL_COMPLETE,
      CONFIG.STATES.APPROACH_VICTIM,
      CONFIG.STATES.COMPLETE,
    ];
    return ordered.includes(this.currentState);
  }

  getCallDuration() {
    if (this.callStartTime && this.callEndTime) {
      return (this.callEndTime - this.callStartTime) / 1000;
    }
    return null;
  }

  getTotalDuration() {
    if (this.startTime) {
      const endTime = this.stateTimestamps[CONFIG.STATES.COMPLETE] || performance.now();
      return (endTime - this.startTime) / 1000;
    }
    return 0;
  }

  // Reset back to where the player needs to resume after a fail
  resetAfterFail() {
    // Resume exactly where the player was (e.g. still needing to pick up the triangle)
    if (this.stateBeforeFail && this.transition(this.stateBeforeFail)) return;

    // Fallback: infer from what was achieved
    if (this.stateTimestamps[CONFIG.STATES.TRIANGLE_PICKUP]) {
      this.transition(CONFIG.STATES.TRIANGLE_HELD);
    } else if (this.stateTimestamps[CONFIG.STATES.VEST_PICKUP]) {
      this.transition(CONFIG.STATES.TRIANGLE_PICKUP);
    } else {
      this.transition(CONFIG.STATES.VEST_PICKUP);
    }
  }
}
