function scrollToNext() {
  document.getElementById("next").scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', function() {
  const questionTimeline = document.getElementById('questionTimeline');
  const askBtn = document.getElementById('askBtn');
  const questionInput = document.getElementById('questionInput');
  const resetBtn = document.querySelector('.reset-btn'); // Changed to querySelector
  let showDeleteButtons = false;

  const STORAGE_KEY = 'savedQuestions';
  
  // Initialize with saved questions or empty array
  let questionGroups = loadQuestions();

  // Load questions from localStorage
  function loadQuestions() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  // Save only original questions to localStorage
  function saveQuestions() {
    const toSave = questionGroups.map(group => ({
      id: group.id,
      title: group.title,
      items: [group.items[0]], // Only save the first item
      expanded: false // Reset expanded state when saved
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }

  // Delete function
  function deleteQuestionGroup(groupId) {
    questionGroups = questionGroups.filter(g => g.id !== groupId);
    saveQuestions();
    renderTimeline();
  }

  // Render timeline
  renderTimeline();
  
  // Ask button event listener
  askBtn.addEventListener('click', function() {
    const questionText = questionInput.value.trim();
    if (questionText) {
      addNewQuestion(questionText);
      questionInput.value = ''; // Clear input
    }
  });
  
  // Reset button event listener
  resetBtn.addEventListener('click', function() {
    showDeleteButtons = !showDeleteButtons; // Toggle delete button visibility
    renderTimeline();
    
      // Toggle button text based on state
  resetBtn.textContent = showDeleteButtons ? 'Delete On' : 'Delete Off';

    if (!showDeleteButtons) {
      saveQuestions(); // Save when hiding delete buttons
    }
  });

  // Add new question function
  async function addNewQuestion(questionText) {
    const newGroupId = questionGroups.length > 0 ? 
      Math.max(...questionGroups.map(g => g.id)) + 1 : 1;
    
    const newGroup = {
      id: newGroupId,
      title: 'Generating title...',
      items: [{
        id: 1,
        description: questionText,
        level: 0,
        understood: false,
        simplifying: false,
        isNew: false,
        simplified: false
      }],
      expanded: true,
      understood: false
    };
    
    questionGroups.unshift(newGroup); // Add to beginning
    saveQuestions();
    renderTimeline();
    
    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: questionText })
      });
      
      const data = await response.json();
      const groupIndex = questionGroups.findIndex(g => g.id === newGroupId);
      if (groupIndex !== -1) {
        questionGroups[groupIndex].title = data.title || createFallbackTitle(questionText);
        saveQuestions();
        renderTimeline();
      }
    } catch (error) {
      console.error('Error generating title:', error);
      const groupIndex = questionGroups.findIndex(g => g.id === newGroupId);
      if (groupIndex !== -1) {
        questionGroups[groupIndex].title = createFallbackTitle(questionText);
        saveQuestions();
        renderTimeline();
      }
    }
  }

  // Helper function for fallback titles
  function createFallbackTitle(text) {
    const words = text.trim().split(/\s+/);
    return words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '');
  }

  // Simplify question function
  async function simplifyQuestion(groupIndex, itemIndex) {
    const group = questionGroups[groupIndex];
    const item = group.items[itemIndex];
    
    try {
      item.simplifying = true;
      renderTimeline();
      
      const response = await fetch('/api/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: item.description })
      });
      
      const data = await response.json();
      
      if (data.simplified) {
        group.items = group.items.filter((i, idx) => idx <= itemIndex || i.level <= item.level);
        
        const newItemId = group.items.length > 0 ? 
          Math.max(...group.items.map(i => i.id)) + 1 : 1;
        
        group.items.splice(itemIndex + 1, 0, {
          id: newItemId,
          description: data.simplified,
          level: item.level + 1,
          understood: false,
          simplifying: false,
          isNew: true,
          simplified: false
        });
        
        item.simplified = true;
        group.expanded = true;
      }
    } catch (error) {
      console.error('Error simplifying question:', error);
    } finally {
      item.simplifying = false;
      renderTimeline();
    }
  }
  
  // Regenerate simplification function
  function regenerateSimplification(groupIndex, itemIndex) {
    const group = questionGroups[groupIndex];
    const item = group.items[itemIndex];
    
    group.items = group.items.filter((i, idx) => idx <= itemIndex || i.level <= item.level);
    item.simplified = false;
    renderTimeline();
  }
  
  // Render timeline function
  function renderTimeline() {
    questionTimeline.innerHTML = '';
    
    if (questionGroups.length === 0) {
      questionTimeline.innerHTML = '<p class="empty-state">No questions yet. Ask a question to get started!</p>';
      return;
    }
    
    questionGroups.forEach((group, groupIndex) => {
      const groupEl = document.createElement('div');
      groupEl.className = `timeline-group ${group.expanded ? 'expanded' : ''}`;
      
      groupEl.innerHTML = `
        <div class="group-header">
          <div class="group-header-content">
            <h3 class="group-title">
              ${group.title}
              <span class="progress-info">${group.items.length} ${group.items.length === 1 ? 'step' : 'steps'}</span>
            </h3>
            ${showDeleteButtons ? `<button class="delete-btn" data-groupid="${group.id}">×</button>` : ''}
          </div>
          <button class="toggle-btn">▼</button>
        </div>
        <div class="group-content"></div>
      `;
      
      const groupContent = groupEl.querySelector('.group-content');
      
      group.items.forEach((item, itemIndex) => {
        const itemEl = document.createElement('div');
        itemEl.className = `timeline-item ${item.understood ? 'completed' : ''} 
                          ${item.simplifying ? 'active' : ''} 
                          ${item.isNew ? 'new-item' : ''}`;
        
        if (item.isNew) item.isNew = false;
        
        itemEl.innerHTML = `
          <div class="question-header">     
            <h4 class="question-title">Step ${itemIndex + 1}</h4>
            ${item.level > 0 ? `<div class="simplified-prefix">Simplified ${item.level > 1 ? `${item.level} times` : 'once'} from original</div>` : ''}
          </div>
          <p class="question-desc">${item.description}</p>
          <div class="action-buttons">
            <button class="btn btn-understand ${item.understood ? 'understood' : ''}" 
                    data-group="${groupIndex}" 
                    data-item="${itemIndex}">
              ${item.understood ? '✓ Understood' : '○ I understand'}
            </button>
            ${item.simplified ? `
              <button class="btn btn-simplified" disabled>✓ Simplified</button>
              <button class="btn btn-regenerate" 
                      data-group="${groupIndex}" 
                      data-item="${itemIndex}">⟳ Regenerate</button>
            ` : `
              <button class="btn btn-simplify ${item.simplifying ? 'simplifying' : ''}" 
                      data-group="${groupIndex}" 
                      data-item="${itemIndex}"
                      ${item.understood ? 'disabled' : ''}>
                ${item.simplifying ? '☰ Simplifying...' : '☰ Simplify'}
              </button>
            `}
          </div>
        `;
        
        groupContent.appendChild(itemEl);
      });
      
      questionTimeline.appendChild(groupEl);
    });
    
    // Add all event listeners
    setupEventListeners();
  }

  // Setup all event listeners
  function setupEventListeners() {
    // Understand buttons
    document.querySelectorAll('.btn-understand').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const groupIndex = parseInt(this.getAttribute('data-group'));
        const itemIndex = parseInt(this.getAttribute('data-item'));
        const group = questionGroups[groupIndex];
        const item = group.items[itemIndex];
        
        item.understood = !item.understood;
        group.understood = group.items.every(i => i.understood);
        
        if (item.understood) {
          item.simplifying = false;
        }
        
        saveQuestions();
        renderTimeline();
      });
    });

    // Simplify buttons
    document.querySelectorAll('.btn-simplify').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const groupIndex = parseInt(this.getAttribute('data-group'));
        const itemIndex = parseInt(this.getAttribute('data-item'));
        simplifyQuestion(groupIndex, itemIndex);
      });
    });
    
    // Regenerate buttons
    document.querySelectorAll('.btn-regenerate').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const groupIndex = parseInt(this.getAttribute('data-group'));
        const itemIndex = parseInt(this.getAttribute('data-item'));
        regenerateSimplification(groupIndex, itemIndex);
      });
    });
    
    // Delete buttons
    if (showDeleteButtons) {
      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          
          const groupId = parseInt(this.getAttribute('data-groupid'));
          const confirmDelete = confirm("Are you sure you want to delete this question from history?");

      if (confirmDelete) {
        deleteQuestionGroup(groupId);
      }

        });
      });
    }
    
    // Toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const groupEl = this.closest('.timeline-group');
        const groupIndex = Array.from(questionTimeline.children).indexOf(groupEl);
        questionGroups[groupIndex].expanded = !questionGroups[groupIndex].expanded;
        renderTimeline();
      });
    });
  }
});
