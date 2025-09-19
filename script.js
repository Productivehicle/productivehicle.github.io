// main.js

async function fetchExerciseData(exerciseName, currentLevel) {
    const prompt = `You are a professional fitness trainer. Generate workout data for "${exerciseName}" exercise.

Level: ${currentLevel}

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
    "sets": number,
    "reps": number or null,
    "duration": number or null
}

Rules:
- For ${currentLevel} level, scale difficulty appropriately
- Use "reps" for countable exercises (push-ups, squats, etc.) 
- Use "duration" in seconds for timed exercises (plank, wall sit, etc.)
- If using reps, set duration to null. If using duration, set reps to null
- No markdown, no explanations, just the JSON object`;
    
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
            })
        }
    );
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    const generatedText = data.candidates[0].content.parts[0].text.trim();
    
    let jsonStr = generatedText;
    if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0];
    } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0];
    }
    
    const exerciseData = JSON.parse(jsonStr);
    
    if (
        typeof exerciseData.sets !== 'number' ||
        (exerciseData.reps !== null && typeof exerciseData.reps !== 'number') ||
        (exerciseData.duration !== null && typeof exerciseData.duration !== 'number')
    ) {
        throw new Error('Invalid response format from Gemini');
    }
    
    return exerciseData;
}


class WorkoutGenerator {
    constructor() {
        this.exercises = [];
        this.currentLevel = 'beginner';
        this.isGenerating = false;
        this.currentExerciseIndex = 0;
        this.isWorkoutActive = false;
        
        this.loadExercisesFromStorage();
        this.initializeEventListeners();
        this.renderExercises();
    }
    
    initializeEventListeners() {
        document.getElementById('addBtn').addEventListener('click', () => this.addExercise());
        document.getElementById('exerciseInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addExercise();
        });
        
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setLevel(e.target.dataset.level));
        });
        
        document.getElementById('completeExerciseBtn').addEventListener('click', () => this.completeExercise());
        document.getElementById('endWorkoutBtn').addEventListener('click', () => this.endWorkout());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartWorkout());
    }
    
    setLevel(level) {
        this.currentLevel = level;
        document.querySelectorAll('.level-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-level="${level}"]`).classList.add('active');
    }
    
    async addExercise() {
        const input = document.getElementById('exerciseInput');
        const exerciseName = input.value.trim();
        
        if (!exerciseName || this.isGenerating) return;
        
        this.isGenerating = true;
        const addBtn = document.getElementById('addBtn');
        const originalText = addBtn.innerHTML;
        addBtn.innerHTML = '<div class="loading"></div>';
        addBtn.disabled = true;
        
        // Temporary loading exercise
        const tempId = Date.now();
        this.addLoadingExercise(tempId, exerciseName);
        
        try {
            const exerciseData = await fetchExerciseData(exerciseName, this.currentLevel);
            
            // Remove loading exercise
            this.removeExercise(tempId);
            
            // Add real exercise
            const exercise = {
                id: Date.now() + 1,
                name: exerciseName,
                level: this.currentLevel,
                sets: exerciseData.sets,
                reps: exerciseData.reps,
                duration: exerciseData.duration,
                timesCompleted: 0,
                baseReps: exerciseData.reps // Track original reps value for progressive overload
            };
            
            this.exercises.push(exercise);
            this.saveExercisesToStorage();
            input.value = '';
            this.renderExercises();
            
        } catch (error) {
            console.error('Error generating exercise:', error);
            this.removeExercise(tempId);
            alert('Error generating exercise data. Please try again.');
        } finally {
            this.isGenerating = false;
            addBtn.innerHTML = originalText;
            addBtn.disabled = false;
        }
    }
    
    addLoadingExercise(id, name) {
        const loadingExercise = {
            id: id,
            name: name,
            level: this.currentLevel,
            loading: true
        };
        this.exercises.push(loadingExercise);
        this.renderExercises();
    }
    
    startWorkout(exerciseId) {
        const exercise = this.exercises.find(ex => ex.id === exerciseId);
        if (!exercise) return;
        
        this.currentExerciseIndex = this.exercises.indexOf(exercise);
        this.isWorkoutActive = true;
        this.showWorkoutSession();
    }
    
    showWorkoutSession() {
        document.getElementById('setupPhase').style.display = 'none';
        document.getElementById('workoutSession').classList.add('active');
        this.updateCurrentExercise();
    }
    
    updateCurrentExercise() {
        const exercise = this.exercises[this.currentExerciseIndex];
        if (!exercise) return;
        
        document.getElementById('currentExerciseName').textContent = exercise.name;
        
        const repsText = exercise.reps ? `${exercise.reps} reps` : '';
        const durationText = exercise.duration ? `${exercise.duration} seconds` : '';
        const workText = repsText || durationText;
        
        document.getElementById('currentExerciseSets').textContent = `${exercise.sets} sets of ${workText}`;
        document.getElementById('progressText').textContent = `Exercise ${this.currentExerciseIndex + 1} of ${this.exercises.length}`;
    }
    
    completeExercise() {
        const exercise = this.exercises[this.currentExerciseIndex];
        if (exercise) {
            exercise.timesCompleted = (exercise.timesCompleted || 0) + 1;
            
            if (exercise.reps !== null && typeof exercise.baseReps === 'number') {
                // Every 30 completions: increase set, reset reps to base
                if (exercise.timesCompleted % 30 === 0) {
                    exercise.sets += 1;
                    exercise.reps = exercise.baseReps;
                } else if (exercise.timesCompleted % 7 === 0) {
                    // Every 7 completions: increase reps by 1
                    exercise.reps += 1;
                }
            }
            
            this.saveExercisesToStorage();
        }
        
        this.currentExerciseIndex++;
        
        if (this.currentExerciseIndex >= this.exercises.length) {
            this.showWorkoutComplete();
        } else {
            this.updateCurrentExercise();
        }
    }
    
    showWorkoutComplete() {
        document.getElementById('workoutSession').classList.remove('active');
        document.getElementById('workoutComplete').classList.add('active');
    }
    
    endWorkout() {
        this.isWorkoutActive = false;
        this.currentExerciseIndex = 0;
        document.getElementById('workoutSession').classList.remove('active');
        document.getElementById('setupPhase').style.display = 'block';
    }
    
    restartWorkout() {
        this.isWorkoutActive = false;
        this.currentExerciseIndex = 0;
        document.getElementById('workoutComplete').classList.remove('active');
        document.getElementById('setupPhase').style.display = 'block';
    }
    
    renderExercises() {
        const container = document.getElementById('exercisesList');
        
        if (this.exercises.length === 0) {
            container.innerHTML = '<div class="empty-state">Add your first exercise above to get started! 🏋️‍♂️</div>';
            return;
        }
        
        container.innerHTML = '';
        this.exercises.forEach((exercise) => {
            const div = document.createElement('div');
            div.className = `exercise-item ${exercise.loading ? 'loading-item' : ''}`;
            
            if (exercise.loading) {
                div.innerHTML = `
                    <div class="exercise-info">
                        <div class="exercise-name">${exercise.name}</div>
                        <div style="color: #888;">Generating sets and reps...</div>
                    </div>
                    <div class="loading"></div>
                `;
            } else {
                div.innerHTML = `
                    <div class="exercise-info">
                        <div class="exercise-name">${exercise.name}</div>
                        <div class="sets-reps">${exercise.sets} sets of ${exercise.reps ? exercise.reps + ' reps' : exercise.duration + ' seconds'}</div>
                    </div>
                    <div class="exercise-actions">
                        <button class="start-btn">Start</button>
                        <button class="delete-btn">Delete</button>
                    </div>
                `;
                div.querySelector('.start-btn').addEventListener('click', () => this.startWorkout(exercise.id));
                div.querySelector('.delete-btn').addEventListener('click', () => {
                    this.removeExercise(exercise.id);
                    this.saveExercisesToStorage();
                });
            }
            
            container.appendChild(div);
        });
    }
    
    removeExercise(id) {
        this.exercises = this.exercises.filter(ex => ex.id !== id);
        this.saveExercisesToStorage();
        this.renderExercises();
    }
    
    saveExercisesToStorage() {
        const saveData = this.exercises.filter(ex => !ex.loading);
        localStorage.setItem('workout_exercises', JSON.stringify(saveData));
    }
    
    loadExercisesFromStorage() {
        const saved = localStorage.getItem('workout_exercises');
        if (saved) {
            try {
                this.exercises = JSON.parse(saved);
            } catch (e) {
                this.exercises = [];
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.workoutApp = new WorkoutGenerator();
});