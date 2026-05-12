#!/bin/bash

# Deploy Build-Empire to AWS (ECS + RDS + ALB)
# Prerequisites:
#   1. Create AWS account: https://aws.amazon.com
#   2. Install AWS CLI: https://aws.amazon.com/cli/
#   3. Configure credentials: aws configure
#   4. Install eksctl (optional, for EKS) or use ECS/Fargate

set -e

echo "🚀 Build-Empire AWS Deployment"
echo "==============================="

# Check for required tools
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Install with: https://aws.amazon.com/cli/"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git not found"
    exit 1
fi

# Verify we're in Build-Empire directory
if [ ! -f "package.json" ] || ! grep -q '"name": "build-empire"' package.json; then
    echo "❌ Please run this script from the Build-Empire root directory"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Run: aws configure"
    exit 1
fi

echo "✅ AWS CLI configured"

# Prompt for AWS region
read -p "Enter AWS region (default: us-east-1): " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}

# Prompt for project name
read -p "Enter project name (default: build-empire): " PROJECT_NAME
PROJECT_NAME=${PROJECT_NAME:-build-empire}

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY_URL="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo ""
echo "📦 AWS Deployment Configuration:"
echo "   Region: $AWS_REGION"
echo "   Project: $PROJECT_NAME"
echo "   Account: $ACCOUNT_ID"
echo "   Registry: $REGISTRY_URL"
echo ""

# Create ECR repositories
echo "📝 Creating ECR repositories..."
for service in api web; do
    REPO_NAME="$PROJECT_NAME-$service"
    
    if aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" &> /dev/null; then
        echo "✅ ECR repository '$REPO_NAME' already exists"
    else
        echo "🔨 Creating ECR repository '$REPO_NAME'..."
        aws ecr create-repository \
            --repository-name "$REPO_NAME" \
            --region "$AWS_REGION" \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES
        echo "✅ ECR repository '$REPO_NAME' created"
    fi
done

echo ""
echo "📝 Creating CloudFormation templates..."

# Create VPC stack template
cat > cfn-vpc.yaml << 'VPC_TEMPLATE'
AWSTemplateFormatVersion: '2010-09-09'
Description: 'VPC for Build-Empire'

Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.10.0/24
      AvailabilityZone: !Select [0, !GetAZs '']

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.11.0/24
      AvailabilityZone: !Select [1, !GetAZs '']

Outputs:
  VpcId:
    Value: !Ref VPC
  PublicSubnets:
    Value: !Join [',', [!Ref PublicSubnet1, !Ref PublicSubnet2]]
  PrivateSubnets:
    Value: !Join [',', [!Ref PrivateSubnet1, !Ref PrivateSubnet2]]
VPC_TEMPLATE

# Create ECS cluster template
cat > cfn-ecs.yaml << 'ECS_TEMPLATE'
AWSTemplateFormatVersion: '2010-09-09'
Description: 'ECS Cluster for Build-Empire'

Parameters:
  ProjectName:
    Type: String
    Default: build-empire

Resources:
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub '${ProjectName}-cluster'
      ClusterSettings:
        - Name: containerInsights
          Value: enabled

  ECSTaskExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

Outputs:
  ClusterId:
    Value: !GetAtt ECSCluster.Arn
  TaskExecutionRoleArn:
    Value: !GetAtt ECSTaskExecutionRole.Arn
ECS_TEMPLATE

# Create RDS template
cat > cfn-rds.yaml << 'RDS_TEMPLATE'
AWSTemplateFormatVersion: '2010-09-09'
Description: 'RDS PostgreSQL for Build-Empire'

Parameters:
  ProjectName:
    Type: String
    Default: build-empire
  DBPassword:
    Type: String
    NoEcho: true
    MinLength: 16

Resources:
  DBSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupName: !Sub '${ProjectName}-db-subnet'
      DBSubnetGroupDescription: Subnet group for Build-Empire DB
      SubnetIds:
        - !ImportValue PrivateSubnet1Id
        - !ImportValue PrivateSubnet2Id

  SecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for PostgreSQL
      VpcId: !ImportValue VpcId

  PostgresDB:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub '${ProjectName}-db'
      Engine: postgres
      EngineVersion: '16.1'
      DBInstanceClass: db.t3.micro
      AllocatedStorage: '20'
      StorageType: gp3
      MasterUsername: build_empire
      MasterUserPassword: !Ref DBPassword
      DBSubnetGroupName: !Ref DBSubnetGroup
      VPCSecurityGroups:
        - !Ref SecurityGroup
      BackupRetentionPeriod: 7
      MultiAZ: false

Outputs:
  DatabaseEndpoint:
    Value: !GetAtt PostgresDB.Endpoint.Address
  DatabasePort:
    Value: !GetAtt PostgresDB.Endpoint.Port
RDS_TEMPLATE

echo "✅ CloudFormation templates created"

echo ""
echo "📋 AWS Deployment Steps:"
echo "1. Create VPC stack:"
echo "   aws cloudformation deploy --template-file cfn-vpc.yaml --stack-name $PROJECT_NAME-vpc --region $AWS_REGION"
echo ""
echo "2. Create ECS cluster:"
echo "   aws cloudformation deploy --template-file cfn-ecs.yaml --stack-name $PROJECT_NAME-ecs --region $AWS_REGION --capabilities CAPABILITY_NAMED_IAM"
echo ""
echo "3. Create RDS database:"
echo "   aws cloudformation deploy --template-file cfn-rds.yaml --stack-name $PROJECT_NAME-rds --region $AWS_REGION --parameter-overrides DBPassword=<strong-password>"
echo ""
echo "4. Build and push Docker images:"
echo "   aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REGISTRY_URL"
echo "   docker build -f apps/api/Dockerfile -t $REGISTRY_URL/$PROJECT_NAME-api:latest ."
echo "   docker push $REGISTRY_URL/$PROJECT_NAME-api:latest"
echo ""
echo "5. Create ECS task definitions and services (see app.json)"
echo ""
echo "6. Create ALB and link to services"
echo ""
echo "🎯 Your app will be live at: https://build-empire-alb.region.elb.amazonaws.com"
echo ""
echo "📚 Reference:"
echo "   ECS Guide: https://docs.aws.amazon.com/ecs/"
echo "   CloudFormation: https://docs.aws.amazon.com/cloudformation/"
echo ""
echo "✅ Configuration ready for AWS deployment!"
