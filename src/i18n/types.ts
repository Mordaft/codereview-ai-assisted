export type SupportedLanguage = 'es' | 'en'

export interface TranslationDictionary {
  common: {
    brandTitle: string
    backToReviews: string
    cancel: string
    save: string
    delete: string
    edit: string
    close: string
    reopen: string
    loading: string
    toggleTheme: string
    toggleLang: string
    langName: string
    langCode: string
    error: string
  }
  sidebar: {
    workspace: string
    reviews: string
    history: string
    settings: string
    localSession: string
    slmConnected: string
  }
  reviews: {
    eyebrow: string
    title: string
    heroTitle: string
    heroSubtitle: string
    newReview: string
    reviewInProgressTooltip: string
    stats: {
      inProgress: string
      activeReviews: string
      pendingSlm: string
      proposalsToReview: string
      publishedComments: string
      total: string
    }
    tabs: {
      active: string
      closed: string
    }
    heading: {
      activeTitle: string
      closedTitle: string
      registeredCount: string
    }
    card: {
      commentsCount: string
      progressAria: string
      slmThinking: string
      analyzingCode: string
      generatingProposals: string
      fileProgress: string
    }
    empty: {
      closedTitle: string
      activeTitle: string
      closedText: string
      activeText: string
    }
    footer: {
      slmReady: string
      localDataNotice: string
    }
  }
  dialogs: {
    connect: {
      eyebrow: string
      title: string
      description: string
      urlLabel: string
      urlPlaceholder: string
      tokenLabel: string
      tokenPlaceholder: string
      tokenHint: string
      statusDefault: string
      statusConnecting: string
      adapterAdapted: string
      adapterEndpoint: string
      adapterInvalidUrl: string
      continueBtn: string
      errorConnecting: string
    }
    proposal: {
      eyebrow: string
      addTitle: string
      editTitle: string
      lineTitle: string
      generalTitle: string
      descLabel: string
      descPlaceholder: string
      authorLabel: string
      categoryLabel: string
      decisionLabel: string
      severityLabel: string
      globalCheckbox: string
      saveProposal: string
      saveChanges: string
    }
    delete: {
      eyebrow: string
      title: string
      warning: string
      confirmBtn: string
    }
  }
  workspace: {
    approveLocally: string
    modifiedFiles: string
    diffView: string
    newProposal: string
    commentsCount: string
    commentsPanelTitle: string
    proposalsCount: string
    singleProposalCount: string
    globalProposal: string
    noFilesDownloaded: string
    noFilesDownloadedText: string
    emptyComments: string
    lineCommentsMarker: string
    reviewProposalBadge: string
    proposalWordSingular: string
    proposalWordPlural: string
    generalComment: string
  }
  settings: {
    eyebrow: string
    title: string
    localOnly: string
    introTitle: string
    introDesc: string
    connEyebrow: string
    connTitle: string
    connDesc: string
    runtimeUrlLabel: string
    runtimeUrlHint: string
    slmModelLabel: string
    refreshModelsTitle: string
    loadingModels: string
    modelsAvailable: string
    modelsError: string
    inferenceEyebrow: string
    inferenceTitle: string
    inferenceDesc: string
    tempLabel: string
    tempHint: string
    maxTokensLabel: string
    maxTokensHint: string
    promptsEyebrow: string
    promptsTitle: string
    promptsDesc: string
    instructionsLabel: string
    instructionsHint: string
    contractLabel: string
    contractHint: string
    statusNotice: string
    testBtn: string
    saveBtn: string
    savedSuccess: string
    saveBtnSuccess: string
    errorRequired: string
    errorSave: string
    errorTest: string
  }
  domain: {
    statuses: {
      inProgress: string
      inPreparation: string
      closed: string
      approved: string
    }
    severities: {
      low: string
      medium: string
      high: string
    }
    categories: {
      solid: string
      security: string
      quality: string
    }
    decisions: {
      pending: string
      desirable: string
      important: string
      blocking: string
    }
    authors: {
      localSlm: string
      localReviewer: string
      remoteReviewer: string
      reviewer: string
    }
  }
  alerts: {
    cannotUpdateReview: string
  }
  history: {
    eyebrow: string
    title: string
    subtitle: string
    platformDistributionTitle: string
    platformDistributionSubtitle: string
    github: string
    gitlab: string
    reviewsCount: string
    activityHeatmapTitle: string
    activityHeatmapSubtitle: string
    legendLess: string
    legendMore: string
    reviewsOnDate: string
    noReviewsOnDate: string
    tableTitle: string
    tableSubtitle: string
    colName: string
    colRepoType: string
    colStatus: string
    colCreatedAt: string
    colProcessedFiles: string
    colSuggestions: string
    colDuration: string
    colModel: string
    emptyReviews: string
    openReview: string
  }
}
