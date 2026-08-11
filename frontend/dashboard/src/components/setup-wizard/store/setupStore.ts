import { create } from 'zustand';

export type SetupStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface Department {
  id: string;
  name: string;
  code: string;
  leadId?: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentCode: string;
  role: string;
  designation: string;
  status: 'pending' | 'valid' | 'invalid';
  error?: string;
  generatedPassword?: string;
}

interface HistoryState {
  depts: Department[];
  emps: Employee[];
}

interface ToastState {
  visible: boolean;
  message: string;
  type: 'info' | 'success' | 'error';
  onUndo?: () => void;
}

interface SetupStore {
  // Session tracking
  sessionId: string;
  setSessionId: (id: string) => void;
  
  // Navigation
  step: SetupStep;
  setStep: (step: SetupStep | ((prev: SetupStep) => SetupStep)) => void;

  // Core Data
  departments: Department[];
  setDepartments: (depts: Department[] | ((prev: Department[]) => Department[])) => void;
  
  employees: Employee[];
  setEmployees: (emps: Employee[] | ((prev: Employee[]) => Employee[])) => void;
  
  // Undo/Redo Engine
  undoStack: HistoryState[];
  redoStack: HistoryState[];
  pushHistory: (depts: Department[], emps: Employee[]) => void;
  undo: () => void;
  redo: () => void;
  
  // Toast
  toast: ToastState;
  showToast: (message: string, type?: 'info'|'success'|'error', onUndo?: () => void) => void;
  hideToast: () => void;
}

export const useSetupStore = create<SetupStore>((set, get) => ({
  sessionId: '',
  setSessionId: (id) => set({ sessionId: id }),

  step: 1,
  setStep: (step) => set((state) => ({ 
    step: typeof step === 'function' ? step(state.step) : step 
  })),

  departments: [],
  setDepartments: (depts) => set((state) => ({ 
    departments: typeof depts === 'function' ? depts(state.departments) : depts 
  })),

  employees: [],
  setEmployees: (emps) => set((state) => ({ 
    employees: typeof emps === 'function' ? emps(state.employees) : emps 
  })),

  undoStack: [],
  redoStack: [],
  pushHistory: (depts, emps) => set((state) => ({
    undoStack: [...state.undoStack.slice(-19), { depts, emps }],
    redoStack: []
  })),
  undo: () => set((state) => {
    if (state.undoStack.length === 0) return state;
    const prev = state.undoStack[state.undoStack.length - 1];
    return {
      redoStack: [...state.redoStack, { depts: state.departments, emps: state.employees }],
      undoStack: state.undoStack.slice(0, -1),
      departments: prev.depts,
      employees: prev.emps
    };
  }),
  redo: () => set((state) => {
    if (state.redoStack.length === 0) return state;
    const next = state.redoStack[state.redoStack.length - 1];
    return {
      undoStack: [...state.undoStack, { depts: state.departments, emps: state.employees }],
      redoStack: state.redoStack.slice(0, -1),
      departments: next.depts,
      employees: next.emps
    };
  }),

  toast: { visible: false, message: '', type: 'info' },
  showToast: (message, type = 'info', onUndo) => {
    set({ toast: { visible: true, message, type, onUndo } });
    if (!onUndo) {
        setTimeout(() => {
            set((state) => ({ toast: { ...state.toast, visible: false } }));
        }, 6000);
    }
  },
  hideToast: () => set((state) => ({
    toast: { ...state.toast, visible: false }
  }))
}));
