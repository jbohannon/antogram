# Android Animation Performance Optimization

## Instructions for Using This Document

1. Work in sequence: Complete phases in order (Phase 0 → Phase 1 → ...)
2. Mark progress: Use `- [x]` to mark completed subtasks
3. Fill Developer Notes: Add notes at beginning and end of each phase as work progresses
4. Sanity checks: Complete ALL sanity checks before moving to next phase
5. Ask before deviating: If unexpected issues arise, ask permission to deviate from plan
6. Use `tmp_scripts/`: Create any temporary scripts/tests/configs here to keep the repo tidy

---

## Context & Goal

Fix slow/frozen ant animation on Android devices by reducing computational overhead in the p5.js animation loop.

---

## Phase 0: Reduce Nearest Bit Search Complexity

**Goal**: Reduce the expensive nearest bit search from 120 checks to 30 per ant per frame.

### Developer Notes - Phase 0 Start

Changed MAX_NEAREST_CHECKS from 120 to 30 in antogram.js:21. User will test the app manually.

### Tasks

- [x] Change `MAX_NEAREST_CHECKS` constant from 120 to 30 in `antogram.js:21`
- [ ] Test on desktop to ensure animation still works properly

### Sanity Checks - Phase 0

- [ ] Animation works smoothly on desktop Safari/Chrome
- [ ] Ants still find and carry bits to form text/images
- [ ] Test with Android browser emulation shows improved performance

### Developer Notes - Phase 0 End

---

## Phase 1: Reduce Frame Rate on Mobile

**Goal**: Lower frame rate from 30fps to 20fps specifically for mobile devices.

### Developer Notes - Phase 1 Start

Implemented mobile detection and conditional frame rate settings in antogram.js:578-579. Mobile devices (detected via user agent and screen width <= 768px) now run at 20fps while desktop maintains 30fps.

### Tasks

- [x] Add mobile detection using `navigator.userAgent` or screen size
- [x] Set `frameRate(20)` for mobile devices in `setup()` function
- [x] Keep 30fps for desktop

### Sanity Checks - Phase 1

- [ ] Desktop maintains 30fps
- [ ] Mobile devices run at 20fps
- [ ] Animation appears smooth enough at lower frame rate

### Developer Notes - Phase 1 End

Phase 1 testing results: Small improvement in animation speed on Android but still very slow. The frame rate reduction helped but more aggressive optimizations are needed. Proceeding to Phase 2.

---

## Phase 2: Optimize Ant Separation Calculations

**Goal**: Reduce ant-to-ant distance checks by implementing simple spatial optimization.

### Developer Notes - Phase 2 Start

Optimized ant separation calculations in calculateSeparation() method (antogram.js:519-556):
- Skip separation when carrying bits (line 521-523)
- Limit checks to max 50 ants per frame (line 528,532)
- Early exit when no nearby ants found (line 547-549)

### Tasks

- [x] Skip separation calculations when ant is carrying a bit (focused on delivery)
- [x] Limit separation checks to maximum 50 other ants per frame
- [x] Add early exit if no nearby ants found

### Sanity Checks - Phase 2

- [ ] Ants still avoid clustering too much
- [ ] Performance improved on mobile emulation
- [ ] No visual degradation of ant behavior

### Developer Notes - Phase 2 End

---

## Phase 3: Reduce Ant Count on Mobile

**Goal**: Use fewer ants (100 instead of 200) on mobile devices for better performance.

### Developer Notes - Phase 3 Start

### Tasks

- [ ] Add mobile detection in ant creation section
- [ ] Set `numAnts = 100` for mobile, `200` for desktop
- [ ] Ensure adequate ant density for text formation

### Sanity Checks - Phase 3

- [ ] Mobile uses 100 ants, desktop uses 200
- [ ] Text/image formation still works with fewer ants
- [ ] Animation runs smoothly on Android emulation

### Developer Notes - Phase 3 End