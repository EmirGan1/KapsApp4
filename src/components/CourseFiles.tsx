import React from 'react';
import CourseFilesManager, { CourseFilesManagerProps, CourseFileItem, COURSE_IB_THEMES, DEFAULT_IB_THEMES } from './CourseFilesManager';
import CourseMaterialCard, { parseTopics, formatTopics, canDeleteFile, DocumentType } from './CourseMaterialCard';
import DownloadHistoryModal, { DownloadLogEntry, DownloadLogsResponse } from './DownloadHistoryModal';

export { 
  CourseFilesManager, 
  CourseMaterialCard, 
  DownloadHistoryModal,
  parseTopics, 
  formatTopics, 
  canDeleteFile,
  COURSE_IB_THEMES, 
  DEFAULT_IB_THEMES 
};

export type { 
  CourseFilesManagerProps, 
  CourseFileItem, 
  DocumentType,
  DownloadLogEntry,
  DownloadLogsResponse
};

export default CourseFilesManager;
