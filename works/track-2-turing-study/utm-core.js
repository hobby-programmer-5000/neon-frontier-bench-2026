/**
 * Universal Turing Machine Core Engine (Cambridge 1936)
 * Authentic deterministic tape machine with four verifiable classical programs.
 * Clean-room ES Module — zero external dependencies.
 */

export const BLANK = '␣';

const DIR_LABEL = {
  [-1]: 'L',
  0: 'N',
  1: 'R',
};

/**
 * Four verifiable Turing Machine programs:
 * 1. binary_increment  — Binary +1 Adder: 10111 (23) → 11000 (24) in 12 steps
 * 2. busy_beaver_3     — 3-State Busy Beaver (Radó 1962): 14 steps, six 1s (111111)
 * 3. palindrome_check  — Binary Palindrome Verifier: 10101 → halts ACCEPT
 * 4. unary_add         — Unary Addition: 111+11 → 11111 in 14 steps
 */
export const PROGRAMS = [
  {
    id: 'binary_increment',
    name: 'Binary +1 Adder',
    description: 'Increments binary integer 10111 (23) with carry propagation to 11000 (24) and rewinds to MSB.',
    initialTape: '10111',
    initialHead: 0,
    initialState: 'SCAN_R',
    haltStates: ['HALT'],
    states: ['SCAN_R', 'CARRY', 'REWIND', 'HALT'],
    transitions: {
      SCAN_R: {
        '0': ['0', 1, 'SCAN_R'],
        '1': ['1', 1, 'SCAN_R'],
        [BLANK]: [BLANK, -1, 'CARRY'],
      },
      CARRY: {
        '1': ['0', -1, 'CARRY'],
        '0': ['1', -1, 'REWIND'],
        [BLANK]: ['1', 0, 'HALT'],
      },
      REWIND: {
        '0': ['0', -1, 'REWIND'],
        '1': ['1', -1, 'REWIND'],
        [BLANK]: [BLANK, 1, 'HALT'],
      },
    },
  },
  {
    id: 'busy_beaver_3',
    name: '3-State Busy Beaver (BB-3)',
    description: 'Classic 3-state, 2-symbol Busy Beaver champion: prints six 1s from blank tape and halts in 14 steps.',
    initialTape: '',
    initialHead: 0,
    initialState: 'A',
    haltStates: ['HALT'],
    states: ['A', 'B', 'C', 'HALT'],
    transitions: {
      A: {
        [BLANK]: ['1', 1, 'B'],
        '1': ['1', 1, 'HALT'],
      },
      B: {
        [BLANK]: [BLANK, 1, 'C'],
        '1': ['1', 1, 'B'],
      },
      C: {
        [BLANK]: ['1', -1, 'C'],
        '1': ['1', -1, 'A'],
      },
    },
  },
  {
    id: 'palindrome_check',
    name: 'Palindrome Verifier',
    description: 'Verifies whether binary word 10101 reads identically forward and backward by matching outer symbols.',
    initialTape: '10101',
    initialHead: 0,
    initialState: 'START',
    haltStates: ['ACCEPT', 'REJECT'],
    states: ['START', 'SEEK_0', 'SEEK_1', 'MATCH_0', 'MATCH_1', 'RETURN', 'ACCEPT', 'REJECT'],
    transitions: {
      START: {
        '0': [BLANK, 1, 'SEEK_0'],
        '1': [BLANK, 1, 'SEEK_1'],
        [BLANK]: [BLANK, 0, 'ACCEPT'],
      },
      SEEK_0: {
        '0': ['0', 1, 'SEEK_0'],
        '1': ['1', 1, 'SEEK_0'],
        [BLANK]: [BLANK, -1, 'MATCH_0'],
      },
      SEEK_1: {
        '0': ['0', 1, 'SEEK_1'],
        '1': ['1', 1, 'SEEK_1'],
        [BLANK]: [BLANK, -1, 'MATCH_1'],
      },
      MATCH_0: {
        '0': [BLANK, -1, 'RETURN'],
        [BLANK]: [BLANK, 0, 'ACCEPT'],
        '1': ['1', 0, 'REJECT'],
      },
      MATCH_1: {
        '1': [BLANK, -1, 'RETURN'],
        [BLANK]: [BLANK, 0, 'ACCEPT'],
        '0': ['0', 0, 'REJECT'],
      },
      RETURN: {
        '0': ['0', -1, 'RETURN'],
        '1': ['1', -1, 'RETURN'],
        [BLANK]: [BLANK, 1, 'START'],
      },
    },
  },
  {
    id: 'unary_add',
    name: 'Unary Addition (3 + 2)',
    description: 'Computes unary sum 111+11 by bridging the + separator, trimming one trailing tally, yielding 11111.',
    initialTape: '111+11',
    initialHead: 0,
    initialState: 'SEEK_PLUS',
    haltStates: ['HALT'],
    states: ['SEEK_PLUS', 'SEEK_END', 'TRIM', 'REWIND', 'HALT'],
    transitions: {
      SEEK_PLUS: {
        '1': ['1', 1, 'SEEK_PLUS'],
        '+': ['1', 1, 'SEEK_END'],
        [BLANK]: [BLANK, 0, 'HALT'],
      },
      SEEK_END: {
        '1': ['1', 1, 'SEEK_END'],
        [BLANK]: [BLANK, -1, 'TRIM'],
      },
      TRIM: {
        '1': [BLANK, -1, 'REWIND'],
        [BLANK]: [BLANK, 0, 'HALT'],
      },
      REWIND: {
        '1': ['1', -1, 'REWIND'],
        [BLANK]: [BLANK, 1, 'HALT'],
      },
    },
  },
];

export class UniversalTuringMachine {
  constructor() {
    this.program = PROGRAMS[0];
    this.tape = new Map();
    this.head = 0;
    this.state = this.program.initialState;
    this.stepCount = 0;
    this.halted = false;
    this.lastMove = 0;
    this.lastRule = null;
    this.lastRuleDetail = null;
    this.reset();
  }

  /**
   * Load one of the registered programs by id (or index) and reset machine state.
   * @param {string|number} id
   */
  loadProgram(id) {
    let found = null;
    if (typeof id === 'number') {
      found = PROGRAMS[id] || null;
    } else if (typeof id === 'string') {
      found = PROGRAMS.find((p) => p.id === id) || null;
    } else if (id && typeof id === 'object' && id.id) {
      found = PROGRAMS.find((p) => p.id === id.id) || null;
    }
    if (!found) {
      throw new Error(`Unknown Turing Machine program: ${String(id)}`);
    }
    this.program = found;
    return this.reset();
  }

  /**
   * Restore tape, head position, state, and step counter to the active program's start.
   */
  reset() {
    this.tape.clear();
    const initial = this.program.initialTape || '';
    for (let i = 0; i < initial.length; i += 1) {
      const ch = initial[i];
      if (ch !== BLANK && ch !== '_' && ch !== ' ') {
        this.tape.set(i, ch);
      }
    }
    this.head = this.program.initialHead ?? 0;
    this.state = this.program.initialState;
    this.stepCount = 0;
    this.halted = this.program.haltStates.includes(this.state);
    this.lastMove = 0;
    this.lastRule = null;
    this.lastRuleDetail = null;
    return this.getState();
  }

  /**
   * Read the symbol at an integer tape cell position.
   * @param {number} pos
   * @returns {string}
   */
  readCell(pos) {
    return this.tape.has(pos) ? this.tape.get(pos) : BLANK;
  }

  /**
   * Execute exactly one deterministic Turing transition.
   * @returns {{ movedDir: -1|0|1, wroteChanged: boolean, halted: boolean, stateObj: object }}
   */
  step() {
    if (this.halted) {
      return {
        movedDir: 0,
        wroteChanged: false,
        halted: true,
        stateObj: this.getState(),
      };
    }

    const fromState = this.state;
    const readSym = this.readCell(this.head);
    const stateRow = this.program.transitions[fromState];
    const transition = stateRow ? stateRow[readSym] : undefined;

    if (!transition) {
      this.halted = true;
      this.lastMove = 0;
      this.lastRule = `δ(${fromState}, ${readSym}) → HALT`;
      this.lastRuleDetail = {
        fromState,
        readSym,
        writeSym: readSym,
        moveDir: 0,
        moveLabel: 'N',
        toState: 'HALT',
      };
      return {
        movedDir: 0,
        wroteChanged: false,
        halted: true,
        stateObj: this.getState(),
      };
    }

    const [writeSym, rawDir, nextState] = transition;
    const movedDir = rawDir > 0 ? 1 : rawDir < 0 ? -1 : 0;
    const wroteChanged = writeSym !== readSym;

    if (writeSym === BLANK) {
      this.tape.delete(this.head);
    } else {
      this.tape.set(this.head, writeSym);
    }

    this.head += movedDir;
    this.state = nextState;
    this.stepCount += 1;
    this.lastMove = movedDir;

    const moveLabel = DIR_LABEL[movedDir] || 'N';
    this.lastRule = `δ(${fromState}, ${readSym}) → (${writeSym}, ${moveLabel}, ${nextState})`;
    this.lastRuleDetail = {
      fromState,
      readSym,
      writeSym,
      moveDir: movedDir,
      moveLabel,
      toState: nextState,
    };

    if (this.program.haltStates.includes(this.state)) {
      this.halted = true;
    }

    return {
      movedDir,
      wroteChanged,
      halted: this.halted,
      stateObj: this.getState(),
    };
  }

  /**
   * Return contiguous trimmed tape content from min written cell to max written cell.
   * @returns {string}
   */
  getTapeString() {
    if (this.tape.size === 0) return '';
    let minPos = Infinity;
    let maxPos = -Infinity;
    for (const pos of this.tape.keys()) {
      if (pos < minPos) minPos = pos;
      if (pos > maxPos) maxPos = pos;
    }
    let out = '';
    for (let p = minPos; p <= maxPos; p += 1) {
      out += this.readCell(p);
    }
    return out;
  }

  /**
   * Snapshot of the complete observable machine state and 15-cell window (-7..+7 around head).
   */
  getState() {
    const tapeWindow = [];
    for (let offset = -7; offset <= 7; offset += 1) {
      const pos = this.head + offset;
      tapeWindow.push({
        pos,
        sym: this.readCell(pos),
        isHead: offset === 0,
      });
    }

    const statesList = this.program.states || [];
    const idx = statesList.indexOf(this.state);

    return {
      programId: this.program.id,
      programName: this.program.name,
      description: this.program.description,
      tapeWindow,
      head: this.head,
      state: this.state,
      stateIndex: idx >= 0 ? idx : 0,
      stateCount: Math.max(1, statesList.length),
      stepCount: this.stepCount,
      halted: this.halted,
      lastMove: this.lastMove,
      lastRule: this.lastRule,
      lastRuleDetail: this.lastRuleDetail,
      nonBlankCount: this.tape.size,
      tapeString: this.getTapeString(),
    };
  }
}
