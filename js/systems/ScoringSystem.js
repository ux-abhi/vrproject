import { CONFIG } from '../config.js';

export class ScoringSystem {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.stepsCompleted = [];
    this.stateEntryTimes = {};
  }

  logStep(state) {
    if (!this.stepsCompleted.includes(state)) {
      this.stepsCompleted.push(state);
      this.stateEntryTimes[state] = performance.now();
    }
  }

  getResults() {
    const totalTime = this.stateManager.getTotalDuration();
    const callDuration = this.stateManager.getCallDuration();
    const failCount = this.stateManager.failCount;

    let grade = 'A';
    let gradeColor = '#4caf50';
    if (totalTime > CONFIG.TIME_FAIR) {
      grade = 'C';
      gradeColor = '#ff9800';
    } else if (totalTime > CONFIG.TIME_GOOD) {
      grade = 'B';
      gradeColor = '#2196f3';
    }

    if (failCount > 0) {
      grade = grade === 'A' ? 'B' : 'C';
      gradeColor = failCount > 1 ? '#ff9800' : '#2196f3';
    }

    return {
      totalTime: this._formatTime(totalTime),
      totalTimeRaw: totalTime,
      callDuration: callDuration ? this._formatTime(callDuration) : 'N/A',
      callDurationRaw: callDuration,
      failCount,
      stepsCompleted: this.stepsCompleted.length,
      grade,
      gradeColor,
    };
  }

  _formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
