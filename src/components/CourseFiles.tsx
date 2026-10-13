import React from 'react';
import CourseFilesManager, { CourseFilesManagerProps, CourseFileItem, COURSE_IB_THEMES, DEFAULT_IB_THEMES } from './CourseFilesManager';
import CourseMaterialCard, { parseTopics, formatTopics, canDeleteFile, DocumentType } from './CourseMaterialCard';

export { 
  CourseFilesManager, 
  CourseMaterialCard, 
  parseTopics, 
  formatTopics, 
  canDeleteFile,
  COURSE_IB_THEMES, 
  DEFAULT_IB_THEMES 
};

export type { 
  CourseFilesManagerProps, 
  CourseFileItem, 
  DocumentType 
};

export default CourseFilesManager;
