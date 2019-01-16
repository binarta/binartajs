#!/usr/bin/env groovy

pipeline {
    agent { label 'ubuntu-1604' }
    stages {
        stage 'update npm', {
            sh 'npm update'
        }
        stage 'update bower', {
            sh 'bower update'
        }
        stage 'build', {
            sh 'gulp'
        }
    }
    post {
        always {
            sh '''rm -rf node_modules & rm -rf bower_components'''
        }
    }
}