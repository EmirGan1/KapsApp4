import React from 'react';
import CourseFilesManager, { CourseFilesManagerProps, CourseFileItem, COURSE_IB_THEMES, DEFAULT_IB_THEMES } from './CourseFilesManager';
import CourseMaterialCard, { parseTopics, formatTopics, canDeleteFile, DocumentType } from './CourseMaterialCard';
import FileUploadModal, { FileUploadPayload } from './FileUploadModal';

export {
  CourseFilesManager,
  CourseMaterialCard,
  FileUploadModal,
  parseTopics,
  formatTopics,
  canDeleteFile,
  COURSE_IB_THEMES,
  DEFAULT_IB_THEMES
};

export type {
  CourseFilesManagerProps,
  CourseFileItem,
  FileUploadPayload,
  DocumentType
};

export default function CourseDetail(props: CourseFilesManagerProps) {
  return <CourseFilesManager {...props} />;
}
