# Frontend Mirroring Cleanup Prompt

## 🎯 Mission Objective

Complete the frontend mirroring cleanup by systematically addressing all identified issues from the comprehensive analysis. This is a **critical migration task** that requires precision, patience, and zero tolerance for errors.

## 🛡️ SAFEGUARD RULES - NON-NEGOTIABLE

### 1. **TAKE YOUR TIME** - NO RUSHING
- **NEVER** work on more than ONE file at a time
- **ALWAYS** read and understand the current state before making changes
- **PAUSE** between files to verify your work
- **STOP** if you feel rushed or overwhelmed

### 2. **NO HALLUCINATIONS** - VERIFY EVERYTHING
- **ALWAYS** read the actual file contents before referencing them
- **NEVER** assume a file exists - verify with `list_dir` or `find_by_name`
- **CROSS-REFERENCE** with the project folder when unsure
- **DOUBLE-CHECK** import paths and component names
- **VERIFY** each change actually works before moving on

### 3. **ONE FILE AT A TIME** - SYSTEMATIC APPROACH
- **COMPLETE** one file entirely before starting the next
- **TEST** each file's changes immediately
- **DOCUMENT** what you changed and why
- **MARK** completed items in the todo list
- **NEVER** batch edit multiple files simultaneously

### 4. **FIX ERRORS AS THEY COME UP** - NO DEBT
- **STOP** immediately when an error occurs
- **INVESTIGATE** the root cause completely
- **FIX** the error before proceeding
- **TEST** the fix thoroughly
- **DOCUMENT** the error and solution
- **NEVER** say "I'll fix this later"

### 5. **NO "GO BACK AND FIX"** - GET IT RIGHT THE FIRST TIME
- **THINK** before you code - plan the change
- **VERIFY** all dependencies exist
- **CHECK** import paths are correct
- **ENSURE** TypeScript types are proper
- **VALIDATE** the change works in context
- **COMPLETE** each task fully before moving on

## 🎯 ADDITIONAL SAFEGUARDS

### 6. **CONTEXT VERIFICATION**
- Always read the parent directory structure first
- Understand the component hierarchy before modifying
- Check for related files that might be affected
- Verify the current implementation matches the analysis

### 7. **IMPORT SAFETY**
- Never add imports without verifying the file exists
- Check TypeScript types are available
- Ensure relative paths are correct
- Test imports actually work

### 8. **COMPONENT INTEGRITY**
- Preserve existing functionality while adding new features
- Don't break existing component interfaces
- Maintain backward compatibility
- Test component interactions

### 9. **ROUTING SAFETY**
- Verify route paths are correct
- Check for route conflicts
- Ensure proper route inheritance
- Test navigation works

### 10. **PERFORMANCE SAFETY**
- Don't add unnecessary dependencies
- Optimize imports and bundle size
- Maintain lazy loading where appropriate
- Test performance impact

## 📋 EXECUTION ORDER - FOLLOW EXACTLY

### Phase 1: Layout System Foundation
**Priority: CRITICAL**
1. Create root layout component
2. Create customer layout component  
3. Create admin layout component
4. Create public layout component
5. Test layout inheritance

### Phase 2: Missing Components
**Priority: HIGH**
1. Investigate and fix 3 missing services
2. Add missing i18n file
3. Add missing auth component
4. Verify all imports work

### Phase 3: Route Organization
**Priority: MEDIUM**
1. Create route groups (public, customer)
2. Organize routes properly
3. Update route structure
4. Test all navigation

### Phase 4: Final Polish
**Priority: LOW**
1. Review extra components
2. Add SEO enhancements
3. Final testing
4. Documentation updates

## 🔍 VERIFICATION CHECKLIST

### Before Each Change
- [ ] I have read the current file contents
- [ ] I understand what this file does
- [ ] I know why this change is needed
- [ ] I have verified all dependencies exist
- [ ] I have checked for potential conflicts

### After Each Change
- [ ] The file compiles without errors
- [ ] All imports are correct
- [ ] TypeScript types are proper
- [ ] The functionality works as expected
- [ ] No existing features were broken
- [ ] I have documented the change

### Before Moving to Next File
- [ ] Current file is complete and working
- [ ] All errors have been resolved
- [ ] Tests pass (if applicable)
- [ ] Documentation is updated
- [ ] Todo item is marked complete

## 🚨 EMERGENCY PROTOCOLS

### If You Encounter an Error
1. **STOP** - Do not proceed
2. **ANALYZE** - Understand the error completely
3. **RESEARCH** - Check the analysis documents
4. **FIX** - Resolve the error completely
5. **TEST** - Verify the fix works
6. **DOCUMENT** - Record what happened
7. **PROCEED** - Only after complete resolution

### If You're Unsure About Something
1. **PAUSE** - Stop working
2. **READ** - Consult the analysis documents
3. **COMPARE** - Check the project folder
4. **VERIFY** - Use tools to confirm facts
5. **ASK** - If still unclear, seek clarification
6. **PROCEED** - Only when confident

### If Something Doesn't Match the Analysis
1. **STOP** - Don't make assumptions
2. **INVESTIGATE** - Find out why it's different
3. **UPDATE** - Correct the analysis if needed
4. **DOCUMENT** - Record the discrepancy
5. **PROCEED** - With updated understanding

## 🎯 SUCCESS CRITERIA

### Completion Metrics
- [ ] All layout components created and working
- [ ] All missing components added and tested
- [ ] All routes properly organized
- [ ] Zero compilation errors
- [ ] Zero runtime errors
- [ ] All functionality preserved
- [ ] Documentation updated

### Quality Standards
- **Zero** misplaced files
- **Zero** broken imports
- **Zero** TypeScript errors
- **Zero** runtime exceptions
- **100%** feature parity maintained
- **100%** layout system functional
- **100%** route organization complete

## 📝 WORKFLOW

### For Each File
1. **READ** the current file completely
2. **UNDERSTAND** its purpose and dependencies
3. **PLAN** the exact changes needed
4. **IMPLEMENT** the changes carefully
5. **TEST** the changes work properly
6. **VERIFY** no regressions occurred
7. **DOCUMENT** what was changed
8. **MARK** the todo item complete
9. **PROCEED** to the next file

### Daily Progress Review
- Review completed items
- Verify quality standards met
- Update progress metrics
- Plan next day's work
- Document any issues found

## 🚀 FINAL REMINDERS

- **PATIENCE** is your most important tool
- **VERIFICATION** prevents rework
- **DOCUMENTATION** ensures maintainability
- **QUALITY** is more important than speed
- **COMPLETION** means done, not "good enough"

---

**Remember**: This is a critical migration task. The goal is perfect completion, not just getting it done. Take the time to do it right the first time.

**Motto**: "One file at a time, done right, no exceptions."

---

*This prompt enforces systematic, error-free completion of the frontend mirroring cleanup through strict safeguards and verification protocols.*
