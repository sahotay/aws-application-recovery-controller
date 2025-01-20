# Application Recovery Controller

This repository contains the architectural details, configuration, and deployment guidelines for a multi-region AWS application designed to handle disaster recovery, scalability, and high availability.
---

## Deployment

1. **Pre-Requisites:**
   - AWS CLI configured with appropriate permissions.
   - CDK CLI installed for infrastructure as code.

2. **Steps:**
   - Clone the repository:
     ```bash
     git clone https://github.com/sahotay/aws-application-recovery-controller.git
     cd aws-application-recovery-controller
     ```
   - Update the configuration files with your environment-specific details.
   - Deploy the infrastructure:
     ```bash
     cdk bootstrap
     cdk deploy ArcAppStack-us-east-1 or cdk deploy ArcAppStack-us-west-2
     ```

---

## Components

### Primary Region:
- **Amazon Aurora:** Hosts the primary database.
- **Lambda Functions:** Fetch messages, process data, and update the database.
- **SQS:** Handles message queues for asynchronous processing.
- **CloudWatch:** Monitors application performance and triggers alerts.

### Disaster Recovery Region:
- **Amazon ARC:** Coordinates failover and recovery between regions.
- **Read Replica (Aurora):** Maintains a synchronized copy of the primary database.
- **Route 53:** Provides DNS routing to redirect traffic during failover.

---

## Monitoring and Logging

- **Amazon CloudWatch:** Logs and monitors performance metrics.
- **AWS X-Ray:** Traces end-to-end application performance.
- **Custom Dashboards:** Provides insights into order processing and DR status.

---

## Contributing

We welcome contributions to improve this project. To contribute:
1. Fork the repository.
2. Create a feature branch.
3. Submit a pull request with a detailed description of changes.

---

Thank you for using this repository!
