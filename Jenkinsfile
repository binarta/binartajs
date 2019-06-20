#!/usr/bin/env groovy

pipeline {
    agent { label 'ubuntu-1604' }
    options {
        buildDiscarder(logRotator(numToKeepStr: '3'))
    }
    stages {
        stage 'update npm', {
            steps {
                sh 'npm update'
            }
        }
        stage 'update bower', {
            steps {
                sh 'bower update'
            }
        }
        stage 'build', {
            steps {
                sh 'gulp'
            }
        }
    }
    post {
        always {
            sh '''rm -rf node_modules & rm -rf bower_components'''
        }
    }
}