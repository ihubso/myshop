// --- Task Management System (Updated with "See More" and inactive tasks) ---

let allTasks = []; // Store all tasks
let MAX_VISIBLE_TASKS = 3;


function initializeTaskEventListeners() {
    // Create announcement button
    const createAnnouncementBtn = document.getElementById('createAnnouncementBtn');
    if (createAnnouncementBtn) {
        createAnnouncementBtn.addEventListener('click', openTaskModal);
    }
    
    // Task form elements
    const isAnnouncementCheck = document.getElementById('isAnnouncementCheck');
    if (isAnnouncementCheck) {
        isAnnouncementCheck.addEventListener('change', toggleAssigneeField);
    }
    
    const saveTaskBtn = document.getElementById('saveTaskBtn');
    if (saveTaskBtn) {
        saveTaskBtn.addEventListener('click', saveTask);
    }
}

// Open task modal
function openTaskModal() {
    // Populate assignee dropdown
    const assigneeSelect = document.getElementById('taskAssignee');
    if (!assigneeSelect) return;
    
    assigneeSelect.innerHTML = `<option value="all">${translations[currentLanguage]?.allUsersAnnouncement || 'All Users (Announcement)'}</option>`;
    
    // Add sales associates
    const associates = users ? users.filter(u => u.role === 'sales') : [];
    associates.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.username;
        opt.textContent = u.firstName && u.surname ? `${u.firstName} ${u.surname}` : u.username;
        assigneeSelect.appendChild(opt);
    });

    // Reset form
    const taskTitle = document.getElementById('taskTitle');
    const taskDescription = document.getElementById('taskDescription');
    const isAnnouncementCheck = document.getElementById('isAnnouncementCheck');
    const taskDueDate = document.getElementById('taskDueDate');
    
    if (taskTitle) taskTitle.value = '';
    if (taskDescription) taskDescription.value = '';
    if (isAnnouncementCheck) isAnnouncementCheck.checked = false;
    if (taskDueDate) taskDueDate.value = '';
    
    toggleAssigneeField(); // Hide if announcement
    openModal('taskModal');
}
// Open the all tasks modal and highlight a specific task
function openTaskModalWithTask(taskId) {
    openAllTasksModal();
    setTimeout(() => {
        highlightTaskInModal(taskId);
    }, 100);
}

// Helper function to highlight a specific task in the modal
function highlightTaskInModal(taskId) {
    const taskElement = document.querySelector(`#modalTasksContainer .task-item[data-id="${taskId}"]`);
    if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        taskElement.style.backgroundColor = '#fef3c7';
        taskElement.style.transition = 'background-color 0.5s';
        setTimeout(() => {
            taskElement.style.backgroundColor = '';
        }, 2000);
    } else {
        // If task not found, maybe it's filtered out - show all tasks
        filterTasks('all');
        setTimeout(() => {
            const taskElementRetry = document.querySelector(`#modalTasksContainer .task-item[data-id="${taskId}"]`);
            if (taskElementRetry) {
                taskElementRetry.scrollIntoView({ behavior: 'smooth', block: 'center' });
                taskElementRetry.style.backgroundColor = '#fef3c7';
                setTimeout(() => {
                    taskElementRetry.style.backgroundColor = '';
                }, 2000);
            }
        }, 200);
    }
}
function toggleAssigneeField() {
    const isAnnounce = document.getElementById('isAnnouncementCheck')?.checked || false;
    const assigneeSection = document.getElementById('assigneeSection');
    const taskAssignee = document.getElementById('taskAssignee');
    
    if (assigneeSection) {
        assigneeSection.classList.toggle('hidden', isAnnounce);
    }
    if (isAnnounce && taskAssignee) {
        taskAssignee.value = 'all';
    }
}

// Save task function
async function saveTask() {
    const title = document.getElementById('taskTitle')?.value.trim();
    if (!title) {
        showMessageModal(translations[currentLanguage]?.titleRequired || 'Title is required.');
        return;
    }

    const isAnnouncement = document.getElementById('isAnnouncementCheck')?.checked || false;
    const assignedTo = isAnnouncement ? 'all' : (document.getElementById('taskAssignee')?.value || 'all');
    const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
    const currentUserId = await getcurrentUserId();

    const client = getSB();
    if (!client) {
        showMessageModal('Database connection failed.');
        return;
    }

    try {
        const taskData = {
            id: crypto.randomUUID(),
            title: title,
            description: document.getElementById('taskDescription')?.value.trim() || '',
            assigned_to: assignedTo,
            created_by: currentUser?.username || 'unknown',
            due_date: document.getElementById('taskDueDate')?.value || null,
            status: 'pending',
            is_announcement: isAnnouncement,
            is_active: true,
            business_id: currentBusinessId,
            created_at: new Date().toISOString()
        };

        // 🔥 SECURE INSERT: Use the secure RPC to insert the task in ONE RLS-proof call
        const { data: savedTask, error } = await client.rpc('insert_task_secure', {
            p_user_id: currentUserId,
            p_record: taskData,
            p_business_id: currentBusinessId
        });

        if (error) throw error;

        if (typeof window.sendBusinessNotification === 'function') {
            await window.sendBusinessNotification({
                type: 'task',
                title: '📋 New Task',
                body: `${title}${assignedTo !== 'all' ? ` assigned to ${assignedTo}` : ' for all users'}`,
                businessId: currentBusinessId,
                data: {
                    taskId: savedTask?.id || taskData.id,
                    taskTitle: title,
                    assignedTo,
                    isAnnouncement,
                    dueDate: taskData.due_date
                },
                customUrl: `${window.location.origin}/shop/`
            });
        }
        
        showMessageModal(translations[currentLanguage]?.taskCreatedSuccess || 'Task created successfully!');
        
        if (typeof showTaskNotificationBar === 'function') {
            showTaskNotificationBar(savedTask);
        }
        
        if (typeof closeTaskModal === 'function') closeTaskModal();
        if (typeof loadTasks === 'function') await loadTasks();

    } catch (err) {
        console.error(err);
        showMessageModal(`${translations[currentLanguage]?.error || 'Error'}: ${err.message}`);
    }
}
// Task action functions
window.markTaskComplete = async (taskId) => {
    const task = allTasks.find(t => String(t.id) === String(taskId));
    if (!task) return;
    
    if (confirm(translations[currentLanguage]?.confirmCompleteTask || 'Mark this task as complete?')) {
        if (typeof showLoading === 'function') showLoading();
        
        const client = getSB();
        if (!client) {
            if (typeof hideLoading === 'function') hideLoading();
            showMessageModal('Database connection failed.');
            return;
        }

        try {
            const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

            // 🔥 SECURE UPDATE: Use the secure RPC to update the task in ONE RLS-proof call
            const { error } = await client.rpc('update_task_secure', {
                p_id: taskId,
                p_record: {
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    completed_by: currentUser?.username || 'unknown'
                },
                p_business_id: currentBusinessId
            });

            if (error) throw error;

            if (typeof window.sendBusinessNotification === 'function') {
                await window.sendBusinessNotification({
                    type: 'task_completed',
                    title: '✅ Task Completed',
                    body: `${task.title} was completed by ${currentUser?.username || 'a user'}`,
                    businessId: currentBusinessId,
                    data: {
                        taskId: task.id,
                        taskTitle: task.title,
                        completedBy: currentUser?.username || 'unknown'
                    },
                    customUrl: `${window.location.origin}/shop/`
                });
            }

            // Update local state
            task.status = 'completed';
            task.completed_at = new Date().toISOString();
            task.completed_by = currentUser?.username || 'unknown';

            if (typeof hideLoading === 'function') hideLoading();
            showMessageModal(translations[currentLanguage]?.taskMarkedComplete || 'Task marked as complete!');
            if (typeof loadTasks === 'function') await loadTasks();

        } catch (error) {
            if (typeof hideLoading === 'function') hideLoading();
            showMessageModal(translations[currentLanguage]?.couldNotMarkTaskComplete || 'Error completing task');
            console.error('Error:', error);
        }
    }
};

window.reactivateTask = async (taskId) => {
    const task = allTasks.find(t => String(t.id) === String(taskId));
    if (!task) return;
    
    if (confirm('Reactivate this task?')) {
        if (typeof showLoading === 'function') showLoading();
        
        const client = getSB();
        if (!client) {
            if (typeof hideLoading === 'function') hideLoading();
            showMessageModal('Database connection failed.');
            return;
        }

        try {
            const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

            // 🔥 SECURE UPDATE: Use the secure RPC to update the task in ONE RLS-proof call
            const { error } = await client.rpc('update_task_secure', {
                p_id: taskId,
                p_record: {
                    status: 'pending',
                    completed_at: null,
                    completed_by: null
                },
                p_business_id: currentBusinessId
            });

            if (error) throw error;

            // Update local state
            task.status = 'pending';
            task.completed_at = null;
            task.completed_by = null;

            if (typeof hideLoading === 'function') hideLoading();
            showMessageModal('Task reactivated!');
            if (typeof loadTasks === 'function') await loadTasks();

        } catch (error) {
            if (typeof hideLoading === 'function') hideLoading();
            showMessageModal('Error reactivating task');
            console.error('Error:', error);
        }
    }
};

window.deleteTask = async (taskId) => {
    const task = allTasks.find(t => String(t.id) === String(taskId));
    if (!task) return;
    
    const message = task.status === 'completed' ? 
        (translations[currentLanguage]?.confirmDeleteCompletedTask || 'Permanently delete this completed task?') :
        (translations[currentLanguage]?.confirmDeleteTask || 'Delete this task?');
    
    if (!confirm(message)) return;
    
    if (typeof showLoading === 'function') showLoading();
    
    const client = getSB();
    if (!client) {
        if (typeof hideLoading === 'function') hideLoading();
        showMessageModal('Database connection failed.');
        return;
    }

    try {
        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        // 🔥 SECURE DELETE: Reuse the secure RPC we created earlier
        const { error } = await client.rpc('delete_task_secure', {
            p_id: taskId,
            p_business_id: currentBusinessId
        });

        if (error) throw error;

        // Remove from local array
        allTasks = allTasks.filter(t => String(t.id) !== String(taskId));
        if (window.tasks) {
            window.tasks = window.tasks.filter(t => String(t.id) !== String(taskId));
        }

        if (typeof hideLoading === 'function') hideLoading();
        showMessageModal(translations[currentLanguage]?.taskDeleted || 'Task deleted successfully');
        if (typeof loadTasks === 'function') await loadTasks();

    } catch (error) {
        if (typeof hideLoading === 'function') hideLoading();
        showMessageModal(translations[currentLanguage]?.errorDeletingTask || 'Error deleting task');
        console.error('Error:', error);
    }
};

function closeTaskModal() {
    closeModal('taskModal');
}
    function setSentiment(value) {
        currentSentiment = value.toLowerCase();
        document.querySelectorAll('.sentiment-btn').forEach(btn => {
            const sentiment = btn.dataset.sentiment?.toLowerCase();
            if (sentiment === value.toLowerCase()) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    
// Load tasks function

// Update visible tasks display
function updateTaskDisplay() {
    const visibleContainer = document.getElementById('visibleTasks') || document.getElementById('taskList21');
    const seeMoreContainer = document.getElementById('seeMoreTasksContainer');
    const noTasksMsg = document.getElementById('noTasksMessage');
    const countBadge = document.getElementById('taskCountBadge');
    
    // Clear current visible tasks
    if (visibleContainer) visibleContainer.innerHTML = '';
    
    // Get pending tasks for main display
    const pendingTasks = allTasks.filter(t => t.status === 'pending' && t.isActive !== false);
    const totalTasks = allTasks.length;
    
    if (countBadge) {
        countBadge.textContent = `${totalTasks} task${totalTasks !== 1 ? 's' : ''} (${pendingTasks.length} pending)`;
        countBadge.className = `text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            pendingTasks.length > 0 ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 
            totalTasks > 0 ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' :
            'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
        }`;
    }
    
    // Show/hide empty state
    if (pendingTasks.length === 0) {
        if (noTasksMsg) noTasksMsg.classList.remove('hidden');
        if (seeMoreContainer) seeMoreContainer.classList.add('hidden');
        
        // Show empty message in visible container
        if (visibleContainer) {
            visibleContainer.innerHTML = '<li class="p-4 text-center text-gray-500">No pending tasks.</li>';
        }
        return;
    } else {
        if (noTasksMsg) noTasksMsg.classList.add('hidden');
    }
    
    // Sort tasks: by due date (soonest first), then by creation date
    const sortedTasks = [...pendingTasks].sort((a, b) => {
        if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Show "See More" if there are more than MAX_VISIBLE_TASKS
    if (seeMoreContainer) {
        if (sortedTasks.length > MAX_VISIBLE_TASKS) {
            seeMoreContainer.classList.remove('hidden');
            
            // Update the "more" count
            const moreCount = sortedTasks.length - MAX_VISIBLE_TASKS;
            const moreCountElement = document.getElementById('moreTasksCount');
            if (moreCountElement) {
                moreCountElement.textContent = `+${moreCount}`;
            }
            
            // Display only first MAX_VISIBLE_TASKS
            const tasksToShow = sortedTasks.slice(0, MAX_VISIBLE_TASKS);
            
            tasksToShow.forEach(task => {
                const taskItem = createTaskItem(task);
                if (visibleContainer) visibleContainer.appendChild(taskItem);
            });
        } else {
            seeMoreContainer.classList.add('hidden');
            
            // Display all tasks
            sortedTasks.forEach(task => {
                const taskItem = createTaskItem(task);
                if (visibleContainer) visibleContainer.appendChild(taskItem);
            });
        }
    } else {
        // Fallback: show all tasks in visible container
        sortedTasks.forEach(task => {
            const taskItem = createTaskItem(task);
            if (visibleContainer) visibleContainer.appendChild(taskItem);
        });
    }
}

// Create a task item element
function createTaskItem(task) {
    const li = document.createElement('li');
    const isCompleted = task.status === 'completed';
    const isAnnouncement = task.isAnnouncement;
    const isOverdue = !isCompleted && task.dueDate && new Date(task.dueDate) < new Date();
    
    li.className = `p-4 border-b border-gray-200 hover:bg-gray-50 task-item ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''} ${isAnnouncement ? 'announcement' : ''}`;
    li.dataset.id = task.id;
    li.dataset.status = task.status;
    
    li.innerHTML = `
        <div class="flex justify-between items-start">
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    ${isAnnouncement ? 
                        `<svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                        </svg>` :
                        `<svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>`
                    }
                    <div class="font-semibold ${isCompleted ? 'text-gray-500 line-through' : isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}">
                        ${task.title}
                    </div>
                    ${isAnnouncement ? 
                        `<span class="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">Announcement</span>` :
                        isCompleted ?
                        `<span class="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">Completed</span>` :
                        isOverdue ?
                        `<span class="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">Overdue</span>` :
                        `<span class="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">Pending</span>`
                    }
                </div>
                <p class="text-sm text-gray-600">${task.description || 'No details provided.'}</p>
                <small class="text-xs text-blue-500">Assigned: ${task.assignedTo === 'all' ? 'Everyone' : task.assignedTo} | Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</small>
                ${task.completedAt ? 
                    `<small class="text-xs text-gray-500 block mt-1">Completed: ${new Date(task.completedAt).toLocaleDateString()}</small>` : 
                    ''
                }
            </div>
            <div class="flex items-center gap-1 ml-2">
                ${!isCompleted ?
                    `<button class="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition complete-task-btn"
                            data-task-id="${task.id}"
                            title="Mark as complete">
                       <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </button>` :
                    `<button class="p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-md transition reactivate-task-btn"
                            data-task-id="${task.id}"
                            title="Reactivate task">
                       <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>`
                }
                <button class="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition delete-task-btn"
                        data-task-id="${task.id}"
                        title="Delete">
                   <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners with stopPropagation
    const completeBtn = li.querySelector('.complete-task-btn');
    if (completeBtn) {
        completeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = completeBtn.getAttribute('data-task-id');
            markTaskComplete(taskId);
        });
    }
    
    const reactivateBtn = li.querySelector('.reactivate-task-btn');
    if (reactivateBtn) {
        reactivateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = reactivateBtn.getAttribute('data-task-id');
            reactivateTask(taskId);
        });
    }
    
    const deleteBtn = li.querySelector('.delete-task-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = deleteBtn.getAttribute('data-task-id');
            deleteTask(taskId);
        });
    }
    
    return li;
}
// "All Tasks" Modal Functions
let taskEscapeHandler = null;

function openAllTasksModal() {
    updateModalTasks();
    updateTaskStatistics();
    openModal('allTasksModal');
    
    // Add escape key listener
    taskEscapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeAllTasksModal();
        }
    };
    document.addEventListener('keydown', taskEscapeHandler);
}

function closeAllTasksModal() {
    closeModal('allTasksModal');
    
    // Remove escape key listener
    if (taskEscapeHandler) {
        document.removeEventListener('keydown', taskEscapeHandler);
        taskEscapeHandler = null;
    }
}

// Update tasks in modal
function updateModalTasks(filter = 'all') {
    const container = document.getElementById('modalTasksContainer');
    const modalCount = document.getElementById('modalTaskCount');
    
    if (!container || !modalCount) return;
    
    container.innerHTML = '';
    
    let filteredTasks = [];
    
    switch(filter) {
        case 'pending':
            filteredTasks = allTasks.filter(t => t.status === 'pending' && t.isActive !== false);
            break;
        case 'completed':
            filteredTasks = allTasks.filter(t => t.status === 'completed');
            break;
        case 'announcements':
            filteredTasks = allTasks.filter(t => t.isAnnouncement);
            break;
        default: // 'all'
            filteredTasks = [...allTasks];
    }
    
    // Sort: pending first, then by due date
    filteredTasks.sort((a, b) => {
        if (a.status !== b.status) {
            return a.status === 'completed' ? 1 : -1;
        }
        if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate) - new Date(b.dueDate);
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Update count
    const pendingCount = filteredTasks.filter(t => t.status === 'pending').length;
    const completedCount = filteredTasks.filter(t => t.status === 'completed').length;
    const announcementsCount = filteredTasks.filter(t => t.isAnnouncement).length;
    
    if (filter === 'all') {
        modalCount.textContent = `${filteredTasks.length} tasks (${pendingCount} pending, ${completedCount} completed)`;
    } else {
        modalCount.textContent = `${filteredTasks.length} ${filter} task${filteredTasks.length !== 1 ? 's' : ''}`;
    }
    
    if (filteredTasks.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <svg class="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-gray-500 dark:text-gray-400">No tasks match this filter</p>
            </div>
        `;
        return;
    }
    
    // Create and append task items
    filteredTasks.forEach(task => {
        const taskItem = createTaskItem(task);
        container.appendChild(taskItem);
    });
}

// Filter tasks in modal
function filterTasks(filterType) {
    // Remove active from all pills
    document.querySelectorAll('.filter-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activate clicked filter
    const activeBtn = document.querySelector(
        `.filter-tab-btn[data-filter="${filterType}"]`
    );

    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Update modal content
    updateModalTasks(filterType);
}

// Update task statistics
function updateTaskStatistics() {
    const total = allTasks.length;
    const pending = allTasks.filter(t => t.status === 'pending' && t.isActive !== false).length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const announcements = allTasks.filter(t => t.isAnnouncement).length;
    
    const statsTotal = document.getElementById('taskStatsTotal');
    const statsPending = document.getElementById('taskStatsPending');
    const statsCompleted = document.getElementById('taskStatsCompleted');
    const statsAnnouncements = document.getElementById('taskStatsAnnouncements');
    
    if (statsTotal) statsTotal.textContent = total;
    if (statsPending) statsPending.textContent = pending;
    if (statsCompleted) statsCompleted.textContent = completed;
    if (statsAnnouncements) statsAnnouncements.textContent = announcements;
    
    // Update tab badges
    const countAll = document.getElementById('taskCountAll');
    const countPending = document.getElementById('taskCountPending');
    const countCompleted = document.getElementById('taskCountCompleted');
    const countAnnouncements = document.getElementById('taskCountAnnouncements');
    
    if (countAll) countAll.textContent = total;
    if (countPending) countPending.textContent = pending;
    if (countCompleted) countCompleted.textContent = completed;
    if (countAnnouncements) countAnnouncements.textContent = announcements;
}



// Compatibility function
function renderTasksInReminderPanel() {
    updateTaskDisplay(); // Use the new function
}

// Add CSS for task styling
const taskStyle = document.createElement('style');
taskStyle.textContent = `
    .task-item {
        @apply bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200;
    }
    
    .task-item.completed {
        @apply bg-gray-50 dark:bg-gray-800/50 opacity-70;
    }
    
    .task-item.overdue {
        border-left-color: #ef4444;
        animation: pulse 2s infinite;
    }
    
    .task-item.announcement {
        border-left-color: #8b5cf6;
    }
    
    .task-filter-tab {
        @apply px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 relative;
    }
    
    .task-filter-tab.active {
        @apply text-blue-600 dark:text-blue-400 border-blue-500 dark:border-blue-400;
    }
    
    .task-tab-badge {
        @apply absolute -top-1 -right-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs font-semibold px-1.5 py-0.5 rounded-full;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.8; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(taskStyle);