/**
 * Donna Desktop - Workflow Manager
 * Saved command sequences that can be executed with one click
 */

class WorkflowManager {
  constructor(options = {}) {
    this.workflows = options.workflows || [];
    this.runningWorkflow = null;
    this.currentStep = 0;
    this.variables = {};

    this.modalElement = null;
    this.editorElement = null;

    this.init();
  }

  init() {
    // Create workflow execution modal
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'workflow-modal';
    this.modalElement.innerHTML = `
      <div class="workflow-backdrop"></div>
      <div class="workflow-container">
        <div class="workflow-header">
          <h3 class="workflow-title"></h3>
          <button class="workflow-close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="workflow-steps"></div>
        <div class="workflow-progress">
          <div class="workflow-progress-bar"></div>
        </div>
        <div class="workflow-actions">
          <button class="workflow-cancel">Cancel</button>
          <button class="workflow-run">Run Workflow</button>
        </div>
      </div>
    `;
    this.modalElement.style.display = 'none';
    document.body.appendChild(this.modalElement);

    // Event listeners
    this.modalElement.querySelector('.workflow-backdrop').addEventListener('click', () => this.closeModal());
    this.modalElement.querySelector('.workflow-close').addEventListener('click', () => this.closeModal());
    this.modalElement.querySelector('.workflow-cancel').addEventListener('click', () => this.cancelWorkflow());
    this.modalElement.querySelector('.workflow-run').addEventListener('click', () => this.startExecution());

    // Listen for workflow events
    window.addEventListener('paletteWorkflow', (e) => {
      this.showWorkflow(e.detail.workflow);
    });
  }

  /**
   * Set workflows from config
   */
  setWorkflows(workflows) {
    this.workflows = workflows || [];
  }

  /**
   * Show workflow confirmation/execution modal
   */
  showWorkflow(workflow) {
    this.runningWorkflow = workflow;
    this.currentStep = 0;
    this.variables = {};

    // Parse variables from commands
    const variables = this.extractVariables(workflow.commands);

    const titleEl = this.modalElement.querySelector('.workflow-title');
    titleEl.textContent = workflow.name;

    const stepsEl = this.modalElement.querySelector('.workflow-steps');

    // Check if we need variable inputs
    if (variables.length > 0) {
      stepsEl.innerHTML = `
        <div class="workflow-variables">
          <p class="variables-intro">This workflow needs some input:</p>
          ${variables.map(v => `
            <div class="variable-input">
              <label for="var-${v.name}">${v.label || v.name}</label>
              <input type="text" id="var-${v.name}" data-var="${v.name}" placeholder="${v.placeholder || ''}" value="${v.default || ''}">
            </div>
          `).join('')}
        </div>
        <div class="workflow-preview">
          <p class="preview-label">Commands to run:</p>
          ${workflow.commands.map((cmd, i) => `
            <div class="workflow-step pending" data-step="${i}">
              <span class="step-number">${i + 1}</span>
              <code class="step-command">${this.escapeHtml(cmd)}</code>
            </div>
          `).join('')}
        </div>
      `;

      // Update preview on variable change
      stepsEl.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => this.updatePreview());
      });
    } else {
      stepsEl.innerHTML = `
        <div class="workflow-preview">
          <p class="preview-label">Commands to run:</p>
          ${workflow.commands.map((cmd, i) => `
            <div class="workflow-step pending" data-step="${i}">
              <span class="step-number">${i + 1}</span>
              <code class="step-command">${this.escapeHtml(cmd)}</code>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Reset progress
    const progressBar = this.modalElement.querySelector('.workflow-progress-bar');
    progressBar.style.width = '0%';

    // Show modal
    this.modalElement.style.display = 'flex';
    requestAnimationFrame(() => {
      this.modalElement.classList.add('open');
    });

    // Focus first input if exists
    const firstInput = stepsEl.querySelector('input');
    firstInput?.focus();
  }

  /**
   * Extract variables from command templates
   * Format: ${variableName:Label Text}
   */
  extractVariables(commands) {
    const variables = [];
    const seen = new Set();

    const pattern = /\$\{(\w+)(?::([^}]*))?\}/g;

    for (const cmd of commands) {
      let match;
      while ((match = pattern.exec(cmd)) !== null) {
        const name = match[1];
        if (!seen.has(name)) {
          seen.add(name);
          variables.push({
            name,
            label: match[2] || name,
            placeholder: '',
            default: ''
          });
        }
      }
    }

    return variables;
  }

  /**
   * Update command preview with variable values
   */
  updatePreview() {
    // Collect variable values
    this.modalElement.querySelectorAll('.variable-input input').forEach(input => {
      this.variables[input.dataset.var] = input.value;
    });

    // Update command previews
    this.modalElement.querySelectorAll('.workflow-step').forEach((stepEl, i) => {
      const cmd = this.runningWorkflow.commands[i];
      const resolved = this.resolveVariables(cmd);
      stepEl.querySelector('.step-command').textContent = resolved;
    });
  }

  /**
   * Resolve variables in a command string
   */
  resolveVariables(cmd) {
    return cmd.replace(/\$\{(\w+)(?::[^}]*)?\}/g, (match, name) => {
      return this.variables[name] || `[${name}]`;
    });
  }

  /**
   * Close the modal
   */
  closeModal() {
    this.modalElement.classList.remove('open');
    setTimeout(() => {
      this.modalElement.style.display = 'none';
    }, 200);
  }

  /**
   * Cancel running workflow
   */
  cancelWorkflow() {
    if (this.runningWorkflow) {
      // Emit cancel event
      window.dispatchEvent(new CustomEvent('workflowCancelled', {
        detail: { workflow: this.runningWorkflow }
      }));
    }
    this.runningWorkflow = null;
    this.currentStep = 0;
    this.closeModal();
  }

  /**
   * Start workflow execution
   */
  async startExecution() {
    if (!this.runningWorkflow) return;

    // Collect final variable values
    this.modalElement.querySelectorAll('.variable-input input').forEach(input => {
      this.variables[input.dataset.var] = input.value;
    });

    // Disable inputs and run button
    this.modalElement.querySelectorAll('input, button').forEach(el => {
      el.disabled = true;
    });

    const commands = this.runningWorkflow.commands.map(cmd => this.resolveVariables(cmd));

    // Execute commands one by one
    for (let i = 0; i < commands.length; i++) {
      this.currentStep = i;
      this.updateStepStatus(i, 'running');

      try {
        await this.executeCommand(commands[i]);
        this.updateStepStatus(i, 'success');
      } catch (error) {
        this.updateStepStatus(i, 'error');

        // Show error and stop
        window.dispatchEvent(new CustomEvent('workflowError', {
          detail: {
            workflow: this.runningWorkflow,
            step: i,
            command: commands[i],
            error: error.message
          }
        }));

        // Re-enable cancel button
        this.modalElement.querySelector('.workflow-cancel').disabled = false;
        return;
      }

      // Update progress
      const progress = ((i + 1) / commands.length) * 100;
      this.modalElement.querySelector('.workflow-progress-bar').style.width = `${progress}%`;
    }

    // Workflow complete
    window.dispatchEvent(new CustomEvent('workflowComplete', {
      detail: { workflow: this.runningWorkflow }
    }));

    // Close modal after short delay
    setTimeout(() => {
      this.closeModal();
      this.runningWorkflow = null;
    }, 1000);
  }

  /**
   * Update visual status of a step
   */
  updateStepStatus(stepIndex, status) {
    const stepEl = this.modalElement.querySelector(`[data-step="${stepIndex}"]`);
    if (stepEl) {
      stepEl.className = `workflow-step ${status}`;
    }
  }

  /**
   * Execute a single command
   */
  executeCommand(command) {
    return new Promise((resolve, reject) => {
      // Emit command event for terminal
      window.dispatchEvent(new CustomEvent('workflowCommand', {
        detail: {
          command,
          onComplete: resolve,
          onError: reject
        }
      }));

      // Timeout after 60 seconds
      setTimeout(() => {
        reject(new Error('Command timed out'));
      }, 60000);
    });
  }

  /**
   * Show workflow editor
   */
  showEditor(workflow = null) {
    const isNew = !workflow;
    const editWorkflow = workflow || {
      name: '',
      description: '',
      commands: [''],
      icon: 'workflow'
    };

    // Create editor modal
    if (!this.editorElement) {
      this.editorElement = document.createElement('div');
      this.editorElement.className = 'workflow-editor-modal';
      document.body.appendChild(this.editorElement);
    }

    this.editorElement.innerHTML = `
      <div class="workflow-backdrop"></div>
      <div class="editor-container">
        <div class="editor-header">
          <h3>${isNew ? 'Create Workflow' : 'Edit Workflow'}</h3>
          <button class="editor-close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="editor-body">
          <div class="editor-field">
            <label>Name</label>
            <input type="text" id="workflow-name" value="${this.escapeHtml(editWorkflow.name)}" placeholder="My Workflow">
          </div>
          <div class="editor-field">
            <label>Description</label>
            <input type="text" id="workflow-desc" value="${this.escapeHtml(editWorkflow.description || '')}" placeholder="What this workflow does">
          </div>
          <div class="editor-field">
            <label>Commands (one per line)</label>
            <textarea id="workflow-commands" rows="6" placeholder="git add .&#10;git commit -m &quot;\${message:Commit message}&quot;&#10;git push">${editWorkflow.commands.join('\n')}</textarea>
            <p class="field-hint">Use \${name:Label} for variables that prompt for input</p>
          </div>
        </div>
        <div class="editor-actions">
          <button class="editor-cancel">Cancel</button>
          <button class="editor-save">${isNew ? 'Create' : 'Save'}</button>
        </div>
      </div>
    `;

    this.editorElement.style.display = 'flex';

    // Event listeners
    this.editorElement.querySelector('.workflow-backdrop').addEventListener('click', () => {
      this.editorElement.style.display = 'none';
    });
    this.editorElement.querySelector('.editor-close').addEventListener('click', () => {
      this.editorElement.style.display = 'none';
    });
    this.editorElement.querySelector('.editor-cancel').addEventListener('click', () => {
      this.editorElement.style.display = 'none';
    });
    this.editorElement.querySelector('.editor-save').addEventListener('click', () => {
      this.saveFromEditor(isNew ? null : workflow.id);
    });
  }

  /**
   * Save workflow from editor
   */
  saveFromEditor(existingId) {
    const name = document.getElementById('workflow-name').value.trim();
    const description = document.getElementById('workflow-desc').value.trim();
    const commandsText = document.getElementById('workflow-commands').value.trim();

    if (!name) {
      alert('Please enter a workflow name');
      return;
    }

    if (!commandsText) {
      alert('Please enter at least one command');
      return;
    }

    const commands = commandsText.split('\n').filter(c => c.trim());

    const workflowData = {
      name,
      description,
      commands,
      icon: 'workflow'
    };

    if (existingId) {
      // Update existing
      window.dispatchEvent(new CustomEvent('workflowUpdate', {
        detail: { id: existingId, ...workflowData }
      }));
    } else {
      // Create new
      window.dispatchEvent(new CustomEvent('workflowCreate', {
        detail: workflowData
      }));
    }

    this.editorElement.style.display = 'none';
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use
window.WorkflowManager = WorkflowManager;
