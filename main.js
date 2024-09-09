let globalToken = '';
let currentPage = 1;
let totalPages = 1;
let owner = '';
let repo = '';
const perPage = 100; // Changed to 100 to match GitHub API's max per_page
let allItems = [];
let workflows = new Set();
let currentView = 'artifacts';
let isPrivateRepo = false;

function setView(view) {
  currentView = view;
  document
    .getElementById('artifactsButton')
    .classList.toggle('active', view === 'artifacts');
  document
    .getElementById('cachesButton')
    .classList.toggle('active', view === 'caches');
}

function handleGetItemsClick() {
  owner = document.getElementById('owner').value;
  repo = document.getElementById('repo').value;
  const token = document.getElementById('token').value;

  if (!owner || !repo) {
    alert('Please enter GitHub username and repository name.');
    return;
  }

  globalToken = token;
  checkRepoPrivacy();
}

async function checkRepoPrivacy() {
  try {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (globalToken) {
      headers.Authorization = `token ${globalToken}`;
    }

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers },
    );
    isPrivateRepo = response.data.private;
    getItems(1);
  } catch (error) {
    handleError(error);
  }
}

async function getItems(page) {
  const itemsList = document.getElementById('itemsList');
  currentPage = page;
  itemsList.innerHTML = 'Loading...';

  try {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (globalToken) {
      headers.Authorization = `token ${globalToken}`;
    }

    const endpoint =
      currentView === 'artifacts'
        ? `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`
        : `https://api.github.com/repos/${owner}/${repo}/actions/caches`;

    const response = await axios.get(endpoint, {
      headers: headers,
      params: {
        per_page: perPage,
        page: page,
      },
    });

    allItems =
      currentView === 'artifacts'
        ? response.data.artifacts
        : response.data.actions_caches;

    totalPages = Math.ceil(response.data.total_count / perPage);

    workflows.clear();
    allItems.forEach((item) =>
      workflows.add(
        currentView === 'artifacts' ? item.workflow_run.head_branch : item.ref,
      ),
    );
    updateWorkflowFilter();

    displayItems();
  } catch (error) {
    handleError(error);
  }
}

function displayItems() {
  const itemsList = document.getElementById('itemsList');
  itemsList.innerHTML = allItems.map((item) => createItemHTML(item)).join('');

  updatePagination();
}

function createItemHTML(item) {
  const isArtifact = currentView === 'artifacts';
  const deleteButtonDisabled = !isPrivateRepo ? 'disabled' : '';
  const deleteButtonTitle = !isPrivateRepo
    ? 'Delete is only available for private repositories'
    : '';

  return `
    <li>
      <div class="item-header">
        <h3 class="item-name">${isArtifact ? item.name : item.key}</h3>
        <span class="item-id">ID: ${item.id}</span>
      </div>
      <div class="item-info">
        <span class="item-date">${
          isArtifact ? 'Created' : 'Last accessed'
        }: ${new Date(
    isArtifact ? item.created_at : item.last_accessed_at,
  ).toLocaleString()}</span>
        <span class="item-size">Size: ${(item.size_in_bytes / 1024).toFixed(
          2,
        )} KB</span>
        <span class="item-workflow">${
          isArtifact ? 'Workflow Branch' : 'Branch'
        }: ${isArtifact ? item.workflow_run.head_branch : item.ref}</span>
      </div>
      <div class="item-actions">
        ${
          isArtifact
            ? `
        <button class="download-link" onclick="downloadArtifact(${item.id}, this)">
          <span class="button-text">Download</span>
          <span class="loading-indicator"></span>
        </button>
        `
            : ''
        }
        <button class="delete-link" onclick="${
          isArtifact
            ? `deleteArtifact(${item.id}, this)`
            : `deleteCache('${item.key}', this)`
        }" ${deleteButtonDisabled} title="${deleteButtonTitle}">
          <span class="button-text">Delete</span>
          <span class="loading-indicator"></span>
        </button>
      </div>
    </li>
  `;
}

function updatePagination() {
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const pageInfo = document.getElementById('pageInfo');

  prevButton.disabled = currentPage === 1;
  nextButton.disabled = currentPage === totalPages;
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

  prevButton.onclick = () => getItems(currentPage - 1);
  nextButton.onclick = () => getItems(currentPage + 1);
}

function updateWorkflowFilter() {
  const workflowFilter = document.getElementById('workflowFilter');
  workflowFilter.innerHTML = '<option value="">All Workflows/Branches</option>';
  workflows.forEach((workflow) => {
    const option = document.createElement('option');
    option.value = workflow;
    option.textContent = workflow;
    workflowFilter.appendChild(option);
  });
}

function applyFilters() {
  currentPage = 1;
  getItems(currentPage);
}

async function downloadArtifact(artifactId, button) {
  try {
    button.classList.add('loading');
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${globalToken}`,
    };

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`,
      {
        headers: headers,
        responseType: 'blob',
      },
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `artifact-${artifactId}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    handleError(error);
  } finally {
    button.classList.remove('loading');
  }
}

async function deleteArtifact(artifactId, button) {
  if (!confirm('Are you sure you want to delete this artifact?')) {
    return;
  }

  try {
    button.classList.add('loading');
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${globalToken}`,
    };

    await axios.delete(
      `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}`,
      { headers: headers },
    );

    allItems = allItems.filter((item) => item.id !== artifactId);
    filteredItems = filteredItems.filter((item) => item.id !== artifactId);
    displayItems();
    alert('Artifact deleted successfully.');
  } catch (error) {
    handleError(error);
  } finally {
    button.classList.remove('loading');
  }
}

async function deleteCache(cacheKey, button) {
  if (!confirm('Are you sure you want to delete this cache?')) {
    return;
  }

  try {
    button.classList.add('loading');
    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${globalToken}`,
    };

    await axios.delete(
      `https://api.github.com/repos/${owner}/${repo}/actions/caches`,
      {
        headers: headers,
        params: { key: cacheKey },
      },
    );

    allItems = allItems.filter((item) => item.key !== cacheKey);
    filteredItems = filteredItems.filter((item) => item.key !== cacheKey);
    displayItems();
    alert('Cache deleted successfully.');
  } catch (error) {
    handleError(error);
  } finally {
    button.classList.remove('loading');
  }
}

function handleError(error) {
  const itemsList = document.getElementById('itemsList');
  if (error.response && error.response.status === 404) {
    itemsList.innerHTML =
      "Repository not found or you don't have access. If it's a private repository, please provide a valid access token.";
  } else if (error.response && error.response.status === 403) {
    itemsList.innerHTML =
      "You don't have permission to perform this action. If this is a private repository, make sure to provide a valid access token with the necessary permissions.";
  } else {
    itemsList.innerHTML = `Error: ${
      error.response ? error.response.data.message : error.message
    }`;
  }
}

// Initialize the view
setView('artifacts');

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('getItemsButton')
    .addEventListener('click', handleGetItemsClick);
});
