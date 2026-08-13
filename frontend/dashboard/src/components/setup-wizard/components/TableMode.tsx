import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, CheckSquare, Square, Undo2, Redo2 } from 'lucide-react';
import { useSetupStore } from '../store/setupStore';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentCode: string;
  role: string;
}

interface TableModeProps {
  employees: Employee[];
  departments: Department[];
  onMoveEmployee: (empId: string, deptCode: string) => void;
  onBulkMove: (empIds: string[], deptCode: string) => void;
}

export function TableMode({ employees, departments, onMoveEmployee, onBulkMove }: TableModeProps) {
  const { undo, redo, undoStack, redoStack } = useSetupStore();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [filterDept, setFilterDept] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetDept, setBulkTargetDept] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Filter & Sort
  const filteredEmployees = useMemo(() => {
    const query = debouncedSearch.toLowerCase().trim();
    const tokens = query.split(/\s+/).filter(Boolean);

    return employees.filter(emp => {
      // Ignore global admins in mapping
      if (emp.role.toLowerCase() === 'admin') return false;

      if (unassignedOnly && emp.departmentCode !== 'NONE') return false;
      if (filterDept !== 'ALL' && emp.departmentCode !== filterDept) return false;
      if (filterRole !== 'ALL' && emp.role.toLowerCase() !== filterRole.toLowerCase()) return false;

      if (tokens.length > 0) {
        const searchable = `${emp.firstName} ${emp.lastName} ${emp.email}`.toLowerCase();
        if (!tokens.every(token => searchable.includes(token))) return false;
      }

      return true;
    }).sort((a, b) => {
      // Unassigned first, then by name
      if (a.departmentCode === 'NONE' && b.departmentCode !== 'NONE') return -1;
      if (a.departmentCode !== 'NONE' && b.departmentCode === 'NONE') return 1;
      return a.firstName.localeCompare(b.firstName);
    });
  }, [employees, debouncedSearch, filterDept, filterRole, unassignedOnly]);

  // Virtualizer setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // 56px fixed row height
    overscan: 10,
  });

  const allSelected = filteredEmployees.length > 0 && selectedIds.size === filteredEmployees.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredEmployees.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map(e => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkApply = () => {
    if (!bulkTargetDept || selectedIds.size === 0) return;

    if (selectedIds.size > 50) {
      if (!window.confirm(`You are about to reassign ${selectedIds.size} employees. Are you sure?`)) {
        return;
      }
    }

    onBulkMove(Array.from(selectedIds), bulkTargetDept);
    setSelectedIds(new Set()); // clear selection after
    setBulkTargetDept('');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col relative h-[500px]">

      {/* Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-800">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            title="Undo"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            title="Redo"
          >
            <Redo2 className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-[#0A5ED6] dark:text-white transition-colors"
          />
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-medium cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={e => setUnassignedOnly(e.target.checked)}
              className="rounded text-[#0A5ED6]"
            />
            Unassigned Only
          </label>

          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none dark:text-white"
          >
            <option value="ALL">All Departments</option>
            <option value="NONE">No Department</option>
            {departments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>

          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none dark:text-white"
          >
            <option value="ALL">All Roles</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </div>

      {/* Click-to-filter department badges */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2">Quick Filter:</span>
        <button
          onClick={() => setFilterDept('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${filterDept === 'ALL' ? 'bg-[#0A5ED6] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilterDept('NONE')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${filterDept === 'NONE' ? 'bg-red-500 text-white' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'}`}
        >
          Unassigned
        </button>
        {departments.map(d => (
          <button
            key={d.code}
            onClick={() => setFilterDept(d.code)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${filterDept === d.code ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            {d.code}
          </button>
        ))}
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[48px_1fr_1.5fr_1fr_100px] gap-4 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10">
        <div className="flex items-center justify-center cursor-pointer" onClick={toggleSelectAll}>
          {allSelected ? <CheckSquare className="w-4 h-4 text-[#0A5ED6]" /> : someSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
        </div>
        <div>Name</div>
        <div>Email</div>
        <div>Department</div>
        <div>Role</div>
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 relative"
      >
        {filteredEmployees.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            No employees found matching your filters.
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const emp = filteredEmployees[virtualRow.index];
              const isSelected = selectedIds.has(emp.id);
              const isUnassigned = emp.departmentCode === 'NONE';

              return (
                <div
                  key={emp.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`grid grid-cols-[48px_1fr_1.5fr_1fr_100px] gap-4 px-4 items-center border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors ${isUnassigned ? 'border-l-4 border-l-red-500 bg-red-50/10 dark:bg-red-900/10' : 'border-l-4 border-l-transparent'
                    }`}
                >
                  <div className="flex items-center justify-center cursor-pointer h-full" onClick={() => toggleSelect(emp.id)}>
                    {isSelected ? <CheckSquare className="w-4 h-4 text-[#0A5ED6]" /> : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
                  </div>

                  <div className="font-semibold text-sm text-[#0F172A] dark:text-white truncate">
                    {emp.firstName} {emp.lastName}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {emp.email}
                  </div>

                  <div className="pr-4">
                    <select
                      value={emp.departmentCode}
                      onChange={(e) => onMoveEmployee(emp.id, e.target.value)}
                      className={`w-full text-xs rounded-lg px-2 py-1.5 outline-none border ${isUnassigned ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-bold' : 'bg-transparent border-transparent hover:border-slate-200 dark:hover:border-slate-700 dark:text-slate-200'}`}
                    >
                      <option value="NONE">No Department</option>
                      {departments.map(dept => <option key={dept.code} value={dept.code}>{dept.code}</option>)}
                    </select>
                  </div>

                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {emp.role}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] px-4 sm:px-6 py-3 rounded-full flex flex-row items-center gap-3 sm:gap-4 shadow-xl z-20 animate-in slide-in-from-bottom-10 fade-in w-max max-w-[95%] overflow-x-auto no-scrollbar">
          <div className="font-bold text-xs sm:text-sm whitespace-nowrap">
            {selectedIds.size} {selectedIds.size === 1 ? 'employee' : 'employees'} selected
          </div>
          <div className="w-px h-6 bg-slate-700 dark:bg-slate-200 mx-1 sm:mx-2 shrink-0"></div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-xs sm:text-sm text-slate-300 dark:text-slate-600 whitespace-nowrap">Move to:</span>
            <select
              value={bulkTargetDept}
              onChange={e => setBulkTargetDept(e.target.value)}
              className="bg-slate-800 dark:bg-slate-100 border-none rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-bold outline-none text-white dark:text-[#0F172A] cursor-pointer max-w-[120px] sm:max-w-none text-ellipsis"
            >
              <option value="" disabled>Select Department...</option>
              <option value="NONE">No Department</option>
              {departments.map(d => <option key={d.code} value={d.code}>{d.code}</option>)}
            </select>
            <button
              onClick={handleBulkApply}
              disabled={!bulkTargetDept}
              className="bg-[#0A5ED6] text-white px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0B63E0] transition-colors whitespace-nowrap"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
